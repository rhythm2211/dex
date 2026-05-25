"""
Tree-sitter based structure extraction for multi-language code graphs.

Uses official per-language tree-sitter bindings (tree-sitter 0.25+ compatible).
Falls back gracefully when a language grammar is not installed.
"""
from __future__ import annotations

import importlib
import logging
import os
from typing import Callable, Dict, List, Optional, Set, Tuple

logger = logging.getLogger("dex-core")

try:
    from tree_sitter import Language, Parser

    TREE_SITTER_AVAILABLE = True
except ImportError:
    TREE_SITTER_AVAILABLE = False
    Language = None  # type: ignore
    Parser = None  # type: ignore

# DEX language id -> (pip module name, grammar_key)
# grammar_key = None  → call mod.language()
# grammar_key = "foo" → call mod.language_foo()  (e.g. tsx uses language_tsx())
_LANGUAGE_PACKAGES: Dict[str, Tuple[str, Optional[str]]] = {
    "javascript": ("tree_sitter_javascript", None),
    "jsx": ("tree_sitter_javascript", None),        # JS grammar handles JSX natively
    "typescript": ("tree_sitter_typescript", "typescript"),
    "tsx": ("tree_sitter_typescript", "tsx"),        # language_tsx() from same package
    "java": ("tree_sitter_java", None),
    "go": ("tree_sitter_go", None),
    "rust": ("tree_sitter_rust", None),
    "ruby": ("tree_sitter_ruby", None),
}

_CLASS_TYPES: Dict[str, Set[str]] = {
    "javascript": {"class_declaration"},
    "jsx": {"class_declaration"},
    "typescript": {"class_declaration", "interface_declaration"},
    "tsx": {"class_declaration", "interface_declaration"},
    "java": {"class_declaration", "interface_declaration", "enum_declaration", "record_declaration"},
    # Go: type_spec (not type_declaration) — the name field lives on type_spec, not its parent
    "go": {"type_spec"},
    # Rust: structs/enums/traits create class nodes; impl_item handled separately in _walk
    "rust": {"struct_item", "enum_item", "trait_item"},
    "ruby": {"class", "module"},
}

_FUNCTION_TYPES: Dict[str, Set[str]] = {
    "javascript": {
        "function_declaration",
        "generator_function_declaration",
        "method_definition",
        "arrow_function",
    },
    "jsx": {
        "function_declaration",
        "generator_function_declaration",
        "method_definition",
        "arrow_function",
    },
    "typescript": {
        "function_declaration",
        "generator_function_declaration",
        "method_definition",
        "arrow_function",
    },
    "tsx": {
        "function_declaration",
        "generator_function_declaration",
        "method_definition",
        "arrow_function",
    },
    "java": {"method_declaration", "constructor_declaration"},
    "go": {"function_declaration", "method_declaration"},
    "rust": {"function_item"},
    "ruby": {"method"},
}

_IMPORT_TYPES: Dict[str, Set[str]] = {
    "javascript": {"import_statement", "export_statement"},
    "jsx": {"import_statement", "export_statement"},
    "typescript": {"import_statement", "export_statement"},
    "tsx": {"import_statement", "export_statement"},
    "java": {"import_declaration"},
    "go": {"import_declaration", "import_spec"},
    "rust": {"use_declaration", "extern_crate_declaration"},
    "ruby": {"call"},  # require() handled specially
}

_parser_cache: Dict[str, Parser] = {}


def _load_parser(language: str) -> Optional[Parser]:
    if not TREE_SITTER_AVAILABLE:
        return None
    if language in _parser_cache:
        return _parser_cache[language]

    pkg_info = _LANGUAGE_PACKAGES.get(language)
    if not pkg_info:
        return None

    module_name, grammar_key = pkg_info
    try:
        mod = importlib.import_module(module_name)
        if grammar_key and hasattr(mod, f"language_{grammar_key}"):
            lang_obj = Language(getattr(mod, f"language_{grammar_key}")())
        elif hasattr(mod, "language"):
            lang_obj = Language(mod.language())
        else:
            logger.debug("No language() entry point in %s", module_name)
            return None
        parser = Parser(lang_obj)
        _parser_cache[language] = parser
        return parser
    except Exception as exc:
        logger.debug("tree-sitter parser unavailable for %s: %s", language, exc)
        return None


def _node_name(node) -> Optional[str]:
    name_node = node.child_by_field_name("name")
    if name_node is not None:
        return name_node.text.decode("utf-8", errors="replace")
    for child in node.children:
        if child.type in ("identifier", "type_identifier", "property_identifier", "constant"):
            return child.text.decode("utf-8", errors="replace")
    return None


def _line_no(point_row: int) -> int:
    return point_row + 1


def _extract_import_path(node, language: str, source: str) -> Optional[str]:
    if language in ("javascript", "jsx", "typescript", "tsx"):
        if node.type == "import_statement":
            src = node.child_by_field_name("source")
            if src is not None:
                return src.text.decode("utf-8", errors="replace").strip("'\"")
        return None

    if language == "java" and node.type == "import_declaration":
        for child in node.children:
            if child.type == "scoped_identifier" or child.type == "identifier":
                return child.text.decode("utf-8", errors="replace")
        return None

    if language == "go" and node.type in ("import_declaration", "import_spec"):
        for child in node.children:
            if child.type == "interpreted_string_literal" or child.type == "raw_string_literal":
                return child.text.decode("utf-8", errors="replace").strip("`\"")
        return None

    if language == "rust" and node.type == "use_declaration":
        path_node = node.child_by_field_name("argument") or node.child_by_field_name("path")
        if path_node is not None:
            return path_node.text.decode("utf-8", errors="replace")
        return None

    if language == "ruby" and node.type == "call":
        fn = node.child_by_field_name("method")
        if fn is not None and fn.text.decode() in ("require", "require_relative"):
            args = node.child_by_field_name("arguments")
            if args and args.named_child_count > 0:
                first = args.named_children[0] if hasattr(args, "named_children") else None
                if first is None and args.named_child_count:
                    first = args.named_child(0)
                if first is not None:
                    return first.text.decode("utf-8", errors="replace").strip("'\"")
    return None


def _walk(
    node,
    language: str,
    file_path: str,
    scope_stack: List[str],
    nodes: List[dict],
    edges: List[dict],
    resolve_import: Optional[Callable[[str], Optional[str]]],
    seen_ids: Set[str],
):
    node_type = node.type
    class_types = _CLASS_TYPES.get(language, set())
    function_types = _FUNCTION_TYPES.get(language, set())
    import_types = _IMPORT_TYPES.get(language, set())

    pushed_scope = False

    if node_type in class_types:
        name = _node_name(node)
        if name:
            full_name = f"{file_path}::{name}"
            if full_name not in seen_ids:
                seen_ids.add(full_name)
                nodes.append(
                    {
                        "id": full_name,
                        "type": "class",
                        "name": name,
                        "start_line": _line_no(node.start_point[0]),
                        "end_line": _line_no(node.end_point[0]),
                    }
                )
                edges.append({"source": scope_stack[-1], "target": full_name, "relation": "DEFINES"})
            scope_stack.append(full_name)
            pushed_scope = True

    elif node_type == "impl_item" and language == "rust":
        # Rust: `impl MyStruct { fn methods }` — the "type" field holds the implementing type.
        # Create a class-like node and push scope so methods are named File::Type::method.
        type_node = node.child_by_field_name("type")
        if type_node is not None:
            name = type_node.text.decode("utf-8", errors="replace")
            full_name = f"{file_path}::{name}"
            if full_name not in seen_ids:
                seen_ids.add(full_name)
                nodes.append(
                    {
                        "id": full_name,
                        "type": "class",
                        "name": name,
                        "start_line": _line_no(node.start_point[0]),
                        "end_line": _line_no(node.end_point[0]),
                    }
                )
                edges.append({"source": scope_stack[-1], "target": full_name, "relation": "DEFINES"})
            scope_stack.append(full_name)
            pushed_scope = True

    elif node_type in function_types:
        name = _node_name(node)
        if not name and node_type == "arrow_function":
            name = None
        if name:
            scope = scope_stack[-1]
            full_name = f"{scope}::{name}"
            if full_name not in seen_ids:
                seen_ids.add(full_name)
                nodes.append(
                    {
                        "id": full_name,
                        "type": "function",
                        "name": name,
                        "start_line": _line_no(node.start_point[0]),
                        "end_line": _line_no(node.end_point[0]),
                    }
                )
                edges.append({"source": scope, "target": full_name, "relation": "CONTAINS"})

    elif node_type == "variable_declarator":
        # const handler = () => {} / const fn = function() {}
        name = _node_name(node)
        if name:
            value = node.child_by_field_name("value")
            if value is not None and value.type in (
                "arrow_function",
                "function_expression",
                "function",
            ):
                scope = scope_stack[-1]
                full_name = f"{scope}::{name}"
                if full_name not in seen_ids:
                    seen_ids.add(full_name)
                    nodes.append(
                        {
                            "id": full_name,
                            "type": "function",
                            "name": name,
                            "start_line": _line_no(node.start_point[0]),
                            "end_line": _line_no(node.end_point[0]),
                        }
                    )
                    edges.append({"source": scope, "target": full_name, "relation": "CONTAINS"})

    elif node_type in import_types or (
        language == "ruby" and node_type == "call"
    ):
        import_path = _extract_import_path(node, language, "")
        if import_path and resolve_import:
            target = resolve_import(import_path)
            if target:
                edges.append({"source": file_path, "target": target, "relation": "IMPORTS"})

    for child in node.children:
        if child.is_named:
            _walk(child, language, file_path, scope_stack, nodes, edges, resolve_import, seen_ids)

    if pushed_scope:
        scope_stack.pop()


def extract_structure(
    file_content: str,
    file_path: str,
    language: str,
    resolve_import: Optional[Callable[[str], Optional[str]]] = None,
) -> Tuple[List[dict], List[dict], bool]:
    """
    Extract graph nodes/edges from source using tree-sitter.

    Returns (nodes, edges, used_tree_sitter).
    """
    parser = _load_parser(language)
    if parser is None:
        return [], [], False

    try:
        tree = parser.parse(file_content.encode("utf-8"))
    except Exception as exc:
        logger.debug("tree-sitter parse failed for %s: %s", file_path, exc)
        return [], [], False

    nodes: List[dict] = []
    edges: List[dict] = []
    seen_ids: Set[str] = set()
    scope_stack = [file_path]

    _walk(tree.root_node, language, file_path, scope_stack, nodes, edges, resolve_import, seen_ids)

    if nodes or edges:
        logger.debug(
            "tree-sitter %s: %d nodes, %d edges from %s",
            language,
            len(nodes),
            len(edges),
            os.path.basename(file_path),
        )
        return nodes, edges, True

    return [], [], True  # parsed but empty (e.g. empty file)


def supported_languages() -> List[str]:
    """Languages with an installed tree-sitter grammar."""
    return [lang for lang in _LANGUAGE_PACKAGES if _load_parser(lang) is not None]
