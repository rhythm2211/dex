"""
Manifest / config file parser for DEX graph ingestion.

Parses package.json, requirements.txt, pyproject.toml, go.mod,
Dockerfile, docker-compose.yml, schema.prisma, Terraform .tf,
and Kubernetes YAML into first-class graph nodes + edges so the
dependency graph captures infrastructure topology, not just code.

Node ID convention (bracket prefix avoids collision with file paths):
  [npm]:lodash           [pip]:fastapi          [go]:github.com/gin-gonic/gin
  [docker]:python:3.11   [service]:api          [k8s]:default/Deployment/my-app
  [tf]:aws_s3_bucket.x  [prisma]:User
"""
from __future__ import annotations

import json
import logging
import os
import re
from typing import List, Optional, Tuple

logger = logging.getLogger("dex-core")

try:
    import yaml
    _YAML = True
except ImportError:
    _YAML = False

try:
    import toml
    _TOML = True
except ImportError:
    _TOML = False

# Basenames treated as infrastructure manifests (shared with graph_engine / ingestion)
MANIFEST_BASENAMES = frozenset({
    "package.json", "package-lock.json",
    "requirements.txt", "requirements-dev.txt", "requirements-prod.txt",
    "pyproject.toml", "go.mod", "go.sum",
    "schema.prisma",
    "docker-compose.yml", "docker-compose.yaml",
    "compose.yml", "compose.yaml",
    "kubernetes.yaml", "k8s.yaml", "deployment.yaml",
    "setup.py", "pom.xml", "build.gradle", "build.gradle.kts",
    "yarn.lock", "pnpm-lock.yaml",
    ".env", ".env.example", ".env.local",
})

_PRISMA_BUILTIN_TYPES = frozenset({
    "String", "Int", "BigInt", "Float", "Decimal", "Boolean", "DateTime",
    "Json", "Bytes", "Unsupported", "Null", "True", "False",
})


def is_manifest_file(file_path: str) -> bool:
    """True if this path should be parsed as a config/infrastructure manifest."""
    basename = os.path.basename(file_path).lower()
    if basename in MANIFEST_BASENAMES:
        return True
    if basename.startswith("requirements") and basename.endswith(".txt"):
        return True
    if re.match(r"dockerfile(?:\.\w+)?$", basename):
        return True
    ext = os.path.splitext(file_path)[1].lower()
    return ext in (".tf", ".tfvars")


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def parse_manifest(
    file_path: str,
    file_content: str,
    repo_root: str = "",
) -> Tuple[List[dict], List[dict]]:
    """
    Parse a manifest/config file into (nodes, edges).

    All returned nodes carry ``infrastructure=True`` so the graph engine
    colours them appropriately.  Returns ([], []) for unrecognised files.
    """
    basename = os.path.basename(file_path).lower()
    ext = os.path.splitext(file_path)[1].lower()

    try:
        if basename == "package.json":
            return _parse_package_json(file_path, file_content)

        if basename == "package-lock.json":
            return _parse_package_lock(file_path, file_content)

        if basename.startswith("requirements") and basename.endswith(".txt"):
            return _parse_requirements_txt(file_path, file_content)

        if basename == "pyproject.toml":
            return _parse_pyproject_toml(file_path, file_content)

        if basename == "go.mod":
            return _parse_go_mod(file_path, file_content)

        if re.match(r"dockerfile(?:\.\w+)?$", basename):
            return _parse_dockerfile(file_path, file_content)

        if basename in (
            "docker-compose.yml", "docker-compose.yaml",
            "compose.yml", "compose.yaml",
        ):
            return _parse_docker_compose(file_path, file_content)

        if basename == "schema.prisma":
            return _parse_prisma_schema(file_path, file_content)

        if ext == ".tf":
            return _parse_terraform(file_path, file_content)

        if ext in (".yml", ".yaml") and _is_k8s_manifest(file_content):
            return _parse_k8s_manifest(file_path, file_content)

    except Exception as exc:
        logger.debug("manifest_parser: failed to parse %s: %s", file_path, exc)

    return [], []


# ---------------------------------------------------------------------------
# Individual parsers
# ---------------------------------------------------------------------------

def _node(node_id: str, node_type: str, name: str, val: int = 6) -> dict:
    return {
        "id": node_id,
        "type": node_type,
        "name": name,
        "infrastructure": True,
        "val": val,
    }


def _edge(source: str, target: str, relation: str) -> dict:
    return {"source": source, "target": target, "relation": relation}


# ── package.json ─────────────────────────────────────────────────────────────

def _parse_package_json(file_path: str, content: str) -> Tuple[List[dict], List[dict]]:
    data = json.loads(content)
    nodes: List[dict] = []
    edges: List[dict] = []

    all_deps: dict = {}
    all_deps.update(data.get("dependencies", {}) or {})
    all_deps.update(data.get("devDependencies", {}) or {})
    all_deps.update(data.get("peerDependencies", {}) or {})

    seen: set = set()
    for pkg in all_deps:
        nid = f"[npm]:{pkg}"
        if nid not in seen:
            seen.add(nid)
            nodes.append(_node(nid, "npm_dep", pkg))
        edges.append(_edge(file_path, nid, "DEPENDS_ON"))

    return nodes, edges


# ── package-lock.json (direct deps only — avoid transitive graph explosion) ───

def _parse_package_lock(file_path: str, content: str) -> Tuple[List[dict], List[dict]]:
    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        return [], []

    nodes: List[dict] = []
    edges: List[dict] = []
    seen: set = set()
    direct_deps: dict = {}

    # npm lock v1
    if isinstance(data.get("dependencies"), dict):
        direct_deps.update(data["dependencies"])

    # npm lock v2/v3 — root package entry
    packages = data.get("packages") or {}
    root = packages.get("") or packages.get(".") or {}
    if isinstance(root.get("dependencies"), dict):
        direct_deps.update(root["dependencies"])

    for pkg in direct_deps:
        if not isinstance(pkg, str):
            continue
        nid = f"[npm]:{pkg}"
        if nid not in seen:
            seen.add(nid)
            nodes.append(_node(nid, "npm_dep", pkg))
        edges.append(_edge(file_path, nid, "DEPENDS_ON"))

    return nodes, edges


# ── requirements*.txt ────────────────────────────────────────────────────────

def _parse_requirements_txt(file_path: str, content: str) -> Tuple[List[dict], List[dict]]:
    nodes: List[dict] = []
    edges: List[dict] = []
    seen: set = set()

    for line in content.splitlines():
        line = line.strip()
        if not line or line.startswith("#") or line.startswith("-"):
            continue
        pkg = re.split(r"[>=<!;\[@ ]", line)[0].strip().lower()
        if not pkg:
            continue
        nid = f"[pip]:{pkg}"
        if nid not in seen:
            seen.add(nid)
            nodes.append(_node(nid, "pip_dep", pkg))
        edges.append(_edge(file_path, nid, "DEPENDS_ON"))

    return nodes, edges


# ── pyproject.toml ───────────────────────────────────────────────────────────

def _parse_pyproject_toml(file_path: str, content: str) -> Tuple[List[dict], List[dict]]:
    if not _TOML:
        return [], []

    data = toml.loads(content)
    nodes: List[dict] = []
    edges: List[dict] = []
    seen: set = set()

    pkgs: set = set()

    # poetry [tool.poetry.dependencies]
    for pkg, _ in (data.get("tool", {}).get("poetry", {}).get("dependencies", {}) or {}).items():
        if pkg.lower() != "python":
            pkgs.add(pkg.lower())

    # PEP 517 / setuptools [project.dependencies]
    project = data.get("project", {}) or {}
    for dep_str in project.get("dependencies", []) or []:
        pkg = re.split(r"[>=<!;\[@ ]", dep_str)[0].strip().lower()
        if pkg:
            pkgs.add(pkg)
    for dep_str in project.get("optional-dependencies", {}).values():
        if isinstance(dep_str, list):
            for item in dep_str:
                pkg = re.split(r"[>=<!;\[@ ]", str(item))[0].strip().lower()
                if pkg:
                    pkgs.add(pkg)

    for pkg in sorted(pkgs):
        nid = f"[pip]:{pkg}"
        if nid not in seen:
            seen.add(nid)
            nodes.append(_node(nid, "pip_dep", pkg))
        edges.append(_edge(file_path, nid, "DEPENDS_ON"))

    return nodes, edges


# ── go.mod ───────────────────────────────────────────────────────────────────

def _parse_go_mod(file_path: str, content: str) -> Tuple[List[dict], List[dict]]:
    nodes: List[dict] = []
    edges: List[dict] = []
    seen: set = set()
    in_require = False

    for raw_line in content.splitlines():
        line = raw_line.strip()

        if line.startswith("require ("):
            in_require = True
            continue
        if in_require and line == ")":
            in_require = False
            continue

        # single-line: require github.com/foo/bar v1.2.3
        if line.startswith("require "):
            dep_line = line[len("require "):].strip()
        elif in_require:
            dep_line = line
        else:
            continue

        parts = dep_line.split()
        if not parts or parts[0].startswith("//"):
            continue

        module_path = parts[0]
        nid = f"[go]:{module_path}"
        if nid not in seen:
            seen.add(nid)
            nodes.append(_node(nid, "go_dep", module_path))
        edges.append(_edge(file_path, nid, "DEPENDS_ON"))

    return nodes, edges


# ── Dockerfile ───────────────────────────────────────────────────────────────

def _parse_dockerfile(file_path: str, content: str) -> Tuple[List[dict], List[dict]]:
    nodes: List[dict] = []
    edges: List[dict] = []
    seen: set = set()

    for line in content.splitlines():
        m = re.match(r"^FROM\s+(\S+)", line.strip(), re.IGNORECASE)
        if not m:
            continue
        image = m.group(1)
        if image.lower() == "scratch":
            continue
        nid = f"[docker]:{image}"
        if nid not in seen:
            seen.add(nid)
            nodes.append(_node(nid, "docker_image", image, val=8))
        edges.append(_edge(file_path, nid, "DEPENDS_ON"))

    return nodes, edges


# ── docker-compose ───────────────────────────────────────────────────────────

def _parse_docker_compose(file_path: str, content: str) -> Tuple[List[dict], List[dict]]:
    if _YAML:
        return _parse_docker_compose_yaml(file_path, content)
    return _parse_docker_compose_regex(file_path, content)


def _parse_docker_compose_yaml(file_path: str, content: str) -> Tuple[List[dict], List[dict]]:
    data = yaml.safe_load(content)
    if not isinstance(data, dict):
        return [], []

    nodes: List[dict] = []
    edges: List[dict] = []
    seen: set = set()
    svc_ids: dict = {}

    services = data.get("services", {}) or {}
    for svc_name, svc_def in services.items():
        svc_def = svc_def or {}
        svc_id = f"[service]:{svc_name}"
        svc_ids[svc_name] = svc_id

        if svc_id not in seen:
            seen.add(svc_id)
            nodes.append(_node(svc_id, "docker_service", svc_name, val=10))
        edges.append(_edge(file_path, svc_id, "DEFINES"))

        image = svc_def.get("image")
        if image:
            img_id = f"[docker]:{image}"
            if img_id not in seen:
                seen.add(img_id)
                nodes.append(_node(img_id, "docker_image", image, val=8))
            edges.append(_edge(svc_id, img_id, "DEPENDS_ON"))

    # Service-to-service depends_on edges (second pass so all svc_ids are built)
    for svc_name, svc_def in services.items():
        svc_def = svc_def or {}
        deps = svc_def.get("depends_on", [])
        if isinstance(deps, dict):
            deps = list(deps.keys())
        elif isinstance(deps, str):
            deps = [deps]
        for dep in deps:
            src = svc_ids.get(svc_name)
            tgt = svc_ids.get(dep)
            if src and tgt:
                edges.append(_edge(src, tgt, "DEPENDS_ON"))

    return nodes, edges


def _parse_docker_compose_regex(file_path: str, content: str) -> Tuple[List[dict], List[dict]]:
    nodes: List[dict] = []
    edges: List[dict] = []
    seen: set = set()
    current_svc: Optional[str] = None

    for line in content.splitlines():
        svc_m = re.match(r"^  ([\w][\w-]*):\s*$", line)
        img_m = re.match(r"^\s+image:\s+(\S+)", line)

        if svc_m:
            current_svc = svc_m.group(1)
            svc_id = f"[service]:{current_svc}"
            if svc_id not in seen:
                seen.add(svc_id)
                nodes.append(_node(svc_id, "docker_service", current_svc, val=10))
            edges.append(_edge(file_path, svc_id, "DEFINES"))

        if img_m and current_svc:
            image = img_m.group(1)
            img_id = f"[docker]:{image}"
            svc_id = f"[service]:{current_svc}"
            if img_id not in seen:
                seen.add(img_id)
                nodes.append(_node(img_id, "docker_image", image, val=8))
            edges.append(_edge(svc_id, img_id, "DEPENDS_ON"))

    return nodes, edges


# ── schema.prisma ─────────────────────────────────────────────────────────────

def _parse_prisma_schema(file_path: str, content: str) -> Tuple[List[dict], List[dict]]:
    nodes: List[dict] = []
    edges: List[dict] = []
    model_names: set = set()

    # Pass 1: collect all model names so we can detect relations
    for line in content.splitlines():
        m = re.match(r"^model\s+(\w+)\s*\{", line)
        if m:
            model_names.add(m.group(1))

    # Pass 2: emit nodes + relation edges
    current_model: Optional[str] = None
    emitted_relations: set = set()

    for line in content.splitlines():
        m = re.match(r"^model\s+(\w+)\s*\{", line)
        if m:
            current_model = m.group(1)
            nid = f"[prisma]:{current_model}"
            nodes.append(_node(nid, "schema_model", current_model, val=8))
            edges.append(_edge(file_path, nid, "DEFINES"))
            continue

        if current_model and line.strip() == "}":
            current_model = None
            continue

        if current_model:
            # field  TypeName?  or  field  TypeName[]
            rel_m = re.match(r"^\s+\w+\s+(\w+)\??(?:\[\])?\s", line)
            if rel_m:
                related = rel_m.group(1)
                if (
                    related in model_names
                    and related != current_model
                    and related not in _PRISMA_BUILTIN_TYPES
                ):
                    key = f"{current_model}->{related}"
                    if key not in emitted_relations:
                        emitted_relations.add(key)
                        edges.append(_edge(
                            f"[prisma]:{current_model}",
                            f"[prisma]:{related}",
                            "RELATES_TO",
                        ))

    return nodes, edges


# ── Terraform ─────────────────────────────────────────────────────────────────

def _parse_terraform(file_path: str, content: str) -> Tuple[List[dict], List[dict]]:
    nodes: List[dict] = []
    edges: List[dict] = []
    seen: set = set()

    for m in re.finditer(r'resource\s+"([^"]+)"\s+"([^"]+)"', content):
        res_type = m.group(1)
        res_name = m.group(2)
        full_name = f"{res_type}.{res_name}"
        nid = f"[tf]:{full_name}"
        if nid not in seen:
            seen.add(nid)
            nodes.append(_node(nid, "tf_resource", full_name, val=8))
        edges.append(_edge(file_path, nid, "DEFINES"))

    return nodes, edges


# ── Kubernetes YAML ───────────────────────────────────────────────────────────

def _is_k8s_manifest(content: str) -> bool:
    # docker-compose also uses YAML but has top-level `services:`
    if re.search(r"^services:\s*", content, re.MULTILINE):
        return False
    return bool(
        re.search(r"^apiVersion:\s*\S+", content, re.MULTILINE)
        and re.search(r"^kind:\s*\S+", content, re.MULTILINE)
    )


def _parse_k8s_manifest(file_path: str, content: str) -> Tuple[List[dict], List[dict]]:
    if _YAML:
        return _parse_k8s_manifest_yaml(file_path, content)
    return _parse_k8s_manifest_regex(file_path, content)


def _parse_k8s_manifest_yaml(file_path: str, content: str) -> Tuple[List[dict], List[dict]]:
    nodes: List[dict] = []
    edges: List[dict] = []
    seen: set = set()

    try:
        docs = list(yaml.safe_load_all(content))
    except Exception:
        return [], []

    for doc in docs:
        if not isinstance(doc, dict):
            continue
        kind = doc.get("kind", "")
        metadata = doc.get("metadata") or {}
        name = metadata.get("name", "unknown")
        namespace = metadata.get("namespace", "default")
        if not kind:
            continue

        nid = f"[k8s]:{namespace}/{kind}/{name}"
        if nid not in seen:
            seen.add(nid)
            nodes.append(_node(nid, "k8s_resource", f"{kind}/{name}", val=10))
        edges.append(_edge(file_path, nid, "DEFINES"))

        # Extract container images
        containers: list = []
        spec = doc.get("spec") or {}
        containers.extend(spec.get("containers", []) or [])
        template_spec = (spec.get("template") or {}).get("spec") or {}
        containers.extend(template_spec.get("containers", []) or [])

        for ctr in containers:
            if isinstance(ctr, dict) and ctr.get("image"):
                img = ctr["image"]
                img_id = f"[docker]:{img}"
                if img_id not in seen:
                    seen.add(img_id)
                    nodes.append(_node(img_id, "docker_image", img, val=8))
                edges.append(_edge(nid, img_id, "DEPENDS_ON"))

    return nodes, edges


def _parse_k8s_manifest_regex(file_path: str, content: str) -> Tuple[List[dict], List[dict]]:
    nodes: List[dict] = []
    edges: List[dict] = []
    seen: set = set()

    kind_m = re.search(r"^kind:\s*(\S+)", content, re.MULTILINE)
    name_m = re.search(r"^\s+name:\s*(\S+)", content, re.MULTILINE)
    kind = kind_m.group(1) if kind_m else "Resource"
    name = name_m.group(1) if name_m else "unknown"
    nid = f"[k8s]:default/{kind}/{name}"

    if nid not in seen:
        seen.add(nid)
        nodes.append(_node(nid, "k8s_resource", f"{kind}/{name}", val=10))
    edges.append(_edge(file_path, nid, "DEFINES"))

    for img_m in re.finditer(r"^\s+image:\s+(\S+)", content, re.MULTILINE):
        img = img_m.group(1)
        img_id = f"[docker]:{img}"
        if img_id not in seen:
            seen.add(img_id)
            nodes.append(_node(img_id, "docker_image", img, val=8))
        edges.append(_edge(nid, img_id, "DEPENDS_ON"))

    return nodes, edges
