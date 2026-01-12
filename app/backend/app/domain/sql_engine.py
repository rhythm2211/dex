import logging
import pandas as pd
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from backend.app.core.config import settings

logger = logging.getLogger("dex-core")

class CognitiveSQLEngine:
    def __init__(self, db_url: str = settings.DATABASE_URL):
        self.engine = create_engine(db_url)
        self.llm = ChatGroq(
            model_name="llama-3.3-70b-versatile",
            temperature=0,
            groq_api_key=settings.GROQ_API_KEY
        )
        self.max_retries = 3

    def get_schema_context(self) -> str:
        try:
            inspector = pd.read_sql("SELECT name FROM sqlite_master WHERE type='table';", self.engine)
            tables = inspector['name'].tolist()
            schema_summary = []
            
            for table in tables:
                df = pd.read_sql(f"PRAGMA table_info({table})", self.engine)
                columns = df['name'].tolist()
                schema_summary.append(f"Table: {table} | Columns: {', '.join(columns)}")
                
            return "\n".join(schema_summary)
        except Exception as e:
            logger.error(f"Schema extraction failed: {e}")
            return "Schema unavailable."

    def generate_and_execute(self, user_query: str) -> dict:
        schema_context = self.get_schema_context()
        sql_query = self._generate_initial_sql(user_query, schema_context)
        
        attempt = 0
        last_error = None

        while attempt < self.max_retries:
            try:
                logger.info(f"Execution Attempt {attempt + 1}: {sql_query}")
                
                with self.engine.connect() as connection:
                    result_df = pd.read_sql(text(sql_query), connection)
                
                return {
                    "status": "success",
                    "sql_generated": sql_query,
                    "row_count": len(result_df),
                    "data": result_df.to_dict(orient="records"),
                    "columns": result_df.columns.tolist()
                }

            except SQLAlchemyError as db_error:
                last_error = str(db_error.orig)
                logger.warning(f"SQL Execution Error: {last_error}")
                
                sql_query = self._repair_sql(sql_query, last_error, schema_context)
                attempt += 1

        logger.error("Max retries exhausted.")
        return {
            "status": "failed",
            "error": f"Failed after {self.max_retries} attempts. Last error: {last_error}",
            "final_sql": sql_query
        }

    def _generate_initial_sql(self, query: str, schema: str) -> str:
        prompt = ChatPromptTemplate.from_template(
            """
            You are an expert SQL Data Analyst.
            Context: {schema}
            Task: Generate a generic SQL query for: "{query}"
            Constraint: Return ONLY the SQL code. No markdown, no explanations.
            """
        )
        chain = prompt | self.llm
        response = chain.invoke({"schema": schema, "query": query})
        return self._clean_llm_output(response.content)

    def _repair_sql(self, broken_sql: str, error_msg: str, schema: str) -> str:
        prompt = ChatPromptTemplate.from_template(
            """
            The following SQL query failed.
            Schema: {schema}
            Query: {broken_sql}
            Error: {error_msg}
            Task: Fix the SQL syntax or logic to resolve the error.
            Constraint: Return ONLY the corrected SQL code.
            """
        )
        chain = prompt | self.llm
        response = chain.invoke({
            "schema": schema, 
            "broken_sql": broken_sql, 
            "error_msg": error_msg
        })
        return self._clean_llm_output(response.content)

    def _clean_llm_output(self, text: str) -> str:
        return text.replace("```sql", "").replace("```", "").strip()