#!/usr/bin/env python3
import argparse
import hashlib
import json
import mimetypes
import os
import re
import sys
from pathlib import Path
import urllib.parse
import urllib.request
import uuid


DEFAULT_BASE_URL = "https://gitlab.daikuan.qihoo.net"
DEFAULT_PROJECT = "2166"
DEFAULT_REPO = str(Path.home() / "Documents" / "deepbankV2")
DEFAULT_TOKEN_FILE = str(Path.home() / ".config" / "qbot" / "gitlab-token")
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".tif", ".tiff"}
ATTACHMENT_FIELDS = ("attachments", "evidence_files", "image_paths", "screenshot_paths", "screenshots")

SYMPTOMS = [
    "UI behavior regression",
    "Electron / preload transport failure",
    "REST / WS service failure",
    "local runtime or DB failure",
    "E2E or tooling regression",
    "documentation or governance regression",
]

AFFECTED_AREAS = [
    "`src/` UI",
    "`src/components/assistant-ui/`",
    "`electron/`",
    "`server/`",
    "`scripts/` or `runtime-paths.mjs`",
    "`.agent/` or generated context",
    "`test/e2e/`",
    "`docs/` / `.gitlab/`",
]

VISUAL_TYPES = [
    "not a visual/UI issue",
    "deterministic selector-level finding",
    "system-level visual regression with repeated manifestations",
]


def compact(value):
    return str(value or "").strip()


def as_list(value):
    if value is None:
        return []
    if isinstance(value, list):
        return [compact(item) for item in value if compact(item)]
    return [compact(value)] if compact(value) else []


def raw_items(value):
    if value is None:
        return []
    if isinstance(value, list):
        return [item for item in value if item]
    return [value] if value else []


def checkbox(label, selected):
    return f"- [{'x' if label in selected else ' '}] {label}"


def read_file(path):
    with open(path, "r", encoding="utf-8") as handle:
        return handle.read()


def extract_checkboxes(markdown, heading, fallback):
    lines = markdown.splitlines()
    start = None
    for index, line in enumerate(lines):
        if line.strip() == f"### {heading}":
            start = index + 1
            break
    if start is None:
        return fallback
    items = []
    for line in lines[start:]:
        if line.startswith("### "):
            break
        match = re.match(r"\s*-\s*\[\s*[xX]?\s*\]\s*(.+?)\s*$", line)
        if match:
            items.append(match.group(1))
    return items or fallback


def extract_managed_labels(text):
    labels = set()
    patterns = [
        r'upsert_label\s+"[^"]*"\s+"([^"]+)"',
        r'`((?:kind|status|area|priority|dependency|needs|source)/[^`]+)`',
        r'~"((?:kind|status|area|priority|dependency|needs|source)/[^"]+)"',
    ]
    for pattern in patterns:
        for match in re.finditer(pattern, text):
            label = compact(match.group(1))
            if label:
                labels.add(label)
    return labels


def load_governance(repo):
    gitlab_dir = os.path.join(repo, ".gitlab")
    template_dir = os.path.join(gitlab_dir, "issue_templates")
    bug_template_path = os.path.join(template_dir, "Bug.md")
    readme_path = os.path.join(gitlab_dir, "README.md")
    labels_path = os.path.join(gitlab_dir, "scripts", "gitlab_labels.sh")
    missing = [path for path in (bug_template_path, readme_path, labels_path) if not os.path.exists(path)]
    if missing:
        return {"ok": False, "missing": missing}

    bug_template = read_file(bug_template_path)
    readme = read_file(readme_path)
    labels_script = read_file(labels_path)
    template_names = []
    if os.path.isdir(template_dir):
        template_names = sorted(name for name in os.listdir(template_dir) if name.endswith(".md"))
    labels = sorted(extract_managed_labels(readme) | extract_managed_labels(labels_script))
    return {
        "ok": True,
        "repo": repo,
        "bug_template_path": bug_template_path,
        "readme_path": readme_path,
        "labels_path": labels_path,
        "issue_templates": template_names,
        "labels": labels,
        "bug_template_sha256": hashlib.sha256(bug_template.encode("utf-8")).hexdigest(),
        "bug_template": bug_template,
    }


def normalize_title(title):
    text = compact(title)
    if re.match(r"^(【\s*Bug\s*】|\[\s*Bug\s*\]|\[\s*BUG\s*\]|BUG[:：\s])", text, re.I):
        return text
    return f"【Bug】{text}" if text else text


def token_from_env():
    for name in ("GITLAB_TOKEN", "QBOT_FEEDBACK_GITLAB_TOKEN", "DEEPBANK_FEEDBACK_GITLAB_TOKEN"):
        value = compact(os.environ.get(name))
        if value:
            return value
    for name in ("QBOT_FEEDBACK_GITLAB_TOKEN_FILE", "DEEPBANK_FEEDBACK_GITLAB_TOKEN_FILE"):
        path = compact(os.environ.get(name))
        if not path:
            continue
        try:
            with open(path, "r", encoding="utf-8") as handle:
                value = compact(handle.read())
            if value:
                return value
        except OSError:
            pass
    try:
        with open(os.path.expanduser(DEFAULT_TOKEN_FILE), "r", encoding="utf-8") as handle:
            value = compact(handle.read())
        if value:
            return value
    except OSError:
        pass
    return ""


def fenced(text, lang="text"):
    body = compact(text) or "_Not provided._"
    return f"```{lang}\n{body}\n```"


def steps_text(steps):
    items = as_list(steps)
    if not items:
        return "# Provide the smallest reproducible sequence"
    return "\n".join(f"{index + 1}. {step}" for index, step in enumerate(items))


def markdown_attachment_block(uploaded_attachments, attachment_candidates, attachment_upload_errors):
    lines = []
    if uploaded_attachments:
        lines.extend(["", "**Uploaded screenshots / attachments**:"])
        for item in uploaded_attachments:
            lines.append(item.get("markdown") or f"- {item.get('url') or item.get('path')}")
    elif attachment_candidates:
        lines.extend(["", "**Local screenshot / attachment paths pending upload**:"])
        for item in attachment_candidates:
            lines.append(f"- {item.get('path')}")
    if attachment_upload_errors:
        lines.extend(["", "**Attachment upload errors**:"])
        for item in attachment_upload_errors:
            lines.append(f"- {item.get('path')}: {item.get('error')}")
    return lines


def build_description(payload, governance=None, uploaded_attachments=None, attachment_candidates=None, attachment_upload_errors=None):
    problem = payload.get("problem") or {}
    scope = payload.get("scope") or {}
    reproduction = payload.get("reproduction") or {}
    visual = payload.get("visual_finding") or {}
    fix = payload.get("fix_checklist") or {}
    verification = payload.get("verification") or {}
    bug_template = governance.get("bug_template") if governance else ""

    selected_symptoms = set(as_list(problem.get("observed_symptoms") or payload.get("observed_symptoms")))
    selected_areas = set(as_list(payload.get("affected_areas")))
    visual_type = compact(visual.get("type") or "not a visual/UI issue")
    selected_visual = {visual_type}
    symptoms = extract_checkboxes(bug_template, "Problem", SYMPTOMS) if bug_template else SYMPTOMS
    affected_areas = extract_checkboxes(bug_template, "Affected Areas", AFFECTED_AREAS) if bug_template else AFFECTED_AREAS
    visual_types = extract_checkboxes(bug_template, "Deterministic Visual Finding", VISUAL_TYPES) if bug_template else VISUAL_TYPES

    lines = [
        "> **Code agent workflow**",
        "> - Keep this description as the living source of truth for the repro, fix scope, and verification plan.",
        "> - Use issue comments for root-cause analysis, progress updates, blockers, and final self-check results.",
        "> - Keep the task lists below updated as live execution state.",
        "> - `status/in-progress` means this issue is claimed; record an assignee or owner comment before implementation.",
        "> - `status/in-review` means a linked MR owns the review snapshot; inspect the MR instead of starting duplicate work.",
        "",
        "### Problem",
        f"**Short summary**: {compact(problem.get('short_summary') or payload.get('summary') or payload.get('title'))}",
        "",
        "**Observed symptom**:",
        *[checkbox(item, selected_symptoms) for item in symptoms],
        "",
        f"**Expected result**: {compact(problem.get('expected_result') or reproduction.get('expected_result') or payload.get('expected_result'))}",
        "",
        "### Scope",
        f"**In scope**: {compact(scope.get('in_scope') or payload.get('in_scope'))}",
        "",
        f"**Non-goals**: {compact(scope.get('non_goals') or payload.get('non_goals'))}",
        "",
        "### Affected Areas",
        *[checkbox(item, selected_areas) for item in affected_areas],
        "",
        "### Reproduction",
        "1. **Environment**:",
        f"   - Node version: {compact(reproduction.get('node_version') or payload.get('node_version') or 'unknown')}",
        f"   - OS: {compact(reproduction.get('os') or payload.get('os') or 'unknown')}",
        f"   - execution mode: {compact(reproduction.get('execution_mode') or payload.get('execution_mode') or 'unknown')}",
        "2. **Steps**:",
        fenced(steps_text(reproduction.get("steps") or payload.get("steps"))),
        f"3. **Actual result**: {compact(reproduction.get('actual_result') or payload.get('actual_result'))}",
        f"4. **Expected result**: {compact(reproduction.get('expected_result') or payload.get('expected_result'))}",
        "",
        "### Evidence",
        fenced(payload.get("evidence") or reproduction.get("evidence")),
        *markdown_attachment_block(uploaded_attachments or [], attachment_candidates or [], attachment_upload_errors or []),
        "",
        "### Deterministic Visual Finding",
        *[checkbox(item, selected_visual) for item in visual_types],
        f"- issue-intake or visual-review handoff: {compact(visual.get('handoff'))}",
        f"- selector / surface / run id: {compact(visual.get('selector_surface_run_id'))}",
        f"- screenshot / report / packet path: {compact(visual.get('screenshot_report_path') or payload.get('screenshot_report_path'))}",
        f"- suspected local-vs-shared ownership: {compact(visual.get('ownership'))}",
        "",
        "### Fix Checklist",
        f"- [{'x' if fix.get('checked_existing_work') else ' '}] Check status label, assignee, recent comments, and linked/open MRs before starting implementation",
        "- [ ] Move to `status/in-progress` with an assignee or owner comment when the work is claimed",
        f"- [{'x' if fix.get('reproduction_confirmed') else ' '}] Reproduction path is confirmed",
        "- [ ] Root cause is understood well enough to explain in comments or a follow-up edit",
        "- [ ] The fix is implemented",
        "- [ ] Regression coverage or equivalent verification is added or updated when appropriate",
        "",
        "### Verification Checklist",
        f"- [{'x' if verification.get('npm_run_check') else ' '}] `npm run check`",
        "- [ ] `npm run build:ui` when UI or preload behavior changed",
        "- [ ] Reproduction path was re-run after the fix",
        "- [ ] Final self-check results are posted in an issue comment",
        "",
        "### Additional Validation Commands",
        fenced("\n".join(as_list(payload.get("additional_validation_commands"))) or "# add repro, e2e, packaging, or targeted commands when relevant", "bash"),
    ]
    return "\n".join(lines)


def validate(payload):
    missing = []
    if not compact(payload.get("title")):
        missing.append("title")
    reproduction = payload.get("reproduction") or {}
    if not as_list(reproduction.get("steps") or payload.get("steps")):
        missing.append("reproduction.steps")
    if not compact(reproduction.get("actual_result") or payload.get("actual_result")):
        missing.append("actual_result")
    if not compact(reproduction.get("expected_result") or payload.get("expected_result") or (payload.get("problem") or {}).get("expected_result")):
        missing.append("expected_result")
    has_attachment_field = any(payload.get(field) for field in ATTACHMENT_FIELDS)
    if "evidence" not in payload and "screenshot_report_path" not in payload and not has_attachment_field:
        missing.append("evidence")
    return missing


def is_image_path(path):
    return os.path.splitext(path.lower())[1] in IMAGE_EXTENSIONS


def normalize_local_path(value):
    text = compact(value).strip("'\"")
    if text.startswith("file://"):
        text = urllib.parse.urlparse(text).path
    return os.path.expanduser(text)


def attachment_from_item(item, source):
    if isinstance(item, dict):
        path = normalize_local_path(item.get("path") or item.get("file") or item.get("filepath") or item.get("local_path"))
        alt = compact(item.get("alt") or item.get("name") or os.path.basename(path))
    else:
        path = normalize_local_path(item)
        alt = os.path.basename(path)
    if not path:
        return None
    return {"path": path, "alt": alt or os.path.basename(path), "source": source, "explicit": source in ATTACHMENT_FIELDS}


def image_paths_from_text(text, source):
    candidates = []
    value = compact(text)
    if not value:
        return candidates
    direct = normalize_local_path(value)
    if os.path.exists(direct) and os.path.isfile(direct) and is_image_path(direct):
        candidates.append({"path": direct, "alt": os.path.basename(direct), "source": source, "explicit": False})
    pattern = r'(/[^`\n\r"\')\]]+\.(?:png|jpg|jpeg|gif|webp|bmp|tif|tiff))'
    for match in re.finditer(pattern, value, re.I):
        path = normalize_local_path(match.group(1))
        if os.path.exists(path) and os.path.isfile(path) and is_image_path(path):
            candidates.append({"path": path, "alt": os.path.basename(path), "source": source, "explicit": False})
    return candidates


def collect_attachment_candidates(payload):
    candidates = []
    for field in ATTACHMENT_FIELDS:
        for item in raw_items(payload.get(field)):
            candidate = attachment_from_item(item, field)
            if candidate:
                candidates.append(candidate)
    for field in ("evidence", "screenshot_report_path"):
        candidates.extend(image_paths_from_text(payload.get(field), field))
    reproduction = payload.get("reproduction") or {}
    candidates.extend(image_paths_from_text(reproduction.get("evidence"), "reproduction.evidence"))
    visual = payload.get("visual_finding") or {}
    candidates.extend(image_paths_from_text(visual.get("screenshot_report_path"), "visual_finding.screenshot_report_path"))

    deduped = []
    seen = set()
    for item in candidates:
        key = os.path.abspath(item["path"])
        if key in seen:
            continue
        item["path"] = key
        item["exists"] = os.path.exists(key)
        item["is_file"] = os.path.isfile(key)
        item["is_image"] = is_image_path(key)
        seen.add(key)
        deduped.append(item)
    return deduped


def upload_project_file(base_url, project, token, file_path, alt=None):
    encoded_project = urllib.parse.quote(str(project), safe="")
    url = f"{base_url.rstrip('/')}/api/v4/projects/{encoded_project}/uploads"
    boundary = f"----qbotbug{uuid.uuid4().hex}"
    filename = os.path.basename(file_path).replace('"', "")
    content_type = mimetypes.guess_type(file_path)[0] or "application/octet-stream"
    with open(file_path, "rb") as handle:
        content = handle.read()
    parts = [
        f"--{boundary}\r\n".encode("utf-8"),
        f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'.encode("utf-8"),
        f"Content-Type: {content_type}\r\n\r\n".encode("utf-8"),
        content,
        b"\r\n",
        f"--{boundary}--\r\n".encode("utf-8"),
    ]
    request = urllib.request.Request(
        url,
        data=b"".join(parts),
        method="POST",
        headers={
            "PRIVATE-TOKEN": token,
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        uploaded = json.loads(response.read().decode("utf-8"))
    markdown = compact(uploaded.get("markdown"))
    if not markdown and uploaded.get("url"):
        markdown = f"![{alt or filename}]({uploaded['url']})" if is_image_path(file_path) else f"[{alt or filename}]({uploaded['url']})"
    uploaded.update({
        "path": file_path,
        "alt": alt or filename,
        "markdown": markdown,
    })
    return uploaded


def upload_attachments(base_url, project, token, candidates):
    uploaded = []
    errors = []
    for item in candidates:
        path = item.get("path")
        if not item.get("exists") or not item.get("is_file"):
            errors.append({"path": path, "error": "local file does not exist or is not a file"})
            continue
        if not item.get("is_image") and not item.get("explicit"):
            continue
        try:
            uploaded.append(upload_project_file(base_url, project, token, path, item.get("alt")))
        except Exception as exc:
            errors.append({"path": path, "error": str(exc)})
    return uploaded, errors


def post_issue(base_url, project, token, issue):
    encoded_project = urllib.parse.quote(str(project), safe="")
    url = f"{base_url.rstrip('/')}/api/v4/projects/{encoded_project}/issues"
    body = {
        "title": issue["title"],
        "description": issue["description"],
        "labels": ",".join(issue["labels"]),
    }
    for source, target in (("assignee_ids", "assignee_ids"), ("due_date", "due_date"), ("milestone_id", "milestone_id")):
        if issue.get(source):
            body[target] = issue[source]
    data = json.dumps(body, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=data,
        method="POST",
        headers={
            "PRIVATE-TOKEN": token,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def update_issue_labels(base_url, project, iid, token, labels):
    encoded_project = urllib.parse.quote(str(project), safe="")
    url = f"{base_url.rstrip('/')}/api/v4/projects/{encoded_project}/issues/{urllib.parse.quote(str(iid), safe='')}"
    data = json.dumps({"add_labels": ",".join(labels)}, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=data,
        method="PUT",
        headers={
            "PRIVATE-TOKEN": token,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def main():
    parser = argparse.ArgumentParser(description="Create a deepbankV2 GitLab bug issue from a structured JSON payload.")
    parser.add_argument("--input", required=True, help="Path to bug JSON payload.")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL)
    parser.add_argument("--project", default=DEFAULT_PROJECT)
    parser.add_argument("--repo", default=DEFAULT_REPO, help="Local deepbankV2 repo path used to read .gitlab templates and labels.")
    parser.add_argument("--print-only", action="store_true", help="Render issue Markdown without submitting.")
    parser.add_argument("--allow-unknown-labels", action="store_true", help="Allow labels not found in .gitlab label governance.")
    parser.add_argument("--no-upload-attachments", action="store_true", help="Do not upload local screenshot/image attachments before issue creation.")
    parser.add_argument("--allow-attachment-upload-failure", action="store_true", help="Submit the issue even when an attachment upload fails; failures stay in Evidence.")
    args = parser.parse_args()

    with open(args.input, "r", encoding="utf-8") as handle:
        payload = json.load(handle)

    governance = load_governance(args.repo)
    if not governance.get("ok"):
        print(json.dumps({
            "status": "governance_missing",
            "missing": governance.get("missing", []),
            "message": "Cannot read deepbankV2 .gitlab issue template and label governance.",
        }, ensure_ascii=False, indent=2))
        return 5

    labels = as_list(payload.get("labels")) or ["kind/bug", "status/ready"]
    if "kind/bug" not in labels:
        labels.insert(0, "kind/bug")
    unknown_labels = [label for label in labels if label not in set(governance.get("labels") or [])]
    title = normalize_title(payload.get("title"))
    attachment_candidates = collect_attachment_candidates(payload)
    uploaded_attachments = []
    attachment_upload_errors = []
    description = build_description(payload, governance, uploaded_attachments, attachment_candidates, attachment_upload_errors)
    missing = validate(payload)
    issue = {
        "title": title,
        "labels": labels,
        "description": description,
        "assignee_ids": payload.get("assignee_ids"),
        "due_date": payload.get("due_date"),
        "milestone_id": payload.get("milestone_id"),
    }

    result = {
        "status": "draft" if args.print_only or missing else "ready",
        "missing": missing,
        "unknown_labels": unknown_labels,
        "attachment_candidates": attachment_candidates,
        "uploaded_attachments": uploaded_attachments,
        "attachment_upload_errors": attachment_upload_errors,
        "governance": {
            "repo": governance.get("repo"),
            "bug_template_path": governance.get("bug_template_path"),
            "bug_template_sha256": governance.get("bug_template_sha256"),
            "issue_templates": governance.get("issue_templates"),
            "managed_label_count": len(governance.get("labels") or []),
        },
        **issue,
    }
    if unknown_labels and not args.allow_unknown_labels:
        result["status"] = "invalid_labels"
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 6
    if args.print_only or missing:
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0 if not missing else 2

    token = token_from_env()
    if not token:
        result["status"] = "token_missing"
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 3

    if attachment_candidates and not args.no_upload_attachments:
        uploaded_attachments, attachment_upload_errors = upload_attachments(args.base_url, args.project, token, attachment_candidates)
        description = build_description(payload, governance, uploaded_attachments, attachment_candidates, attachment_upload_errors)
        issue["description"] = description
        result["description"] = description
        result["uploaded_attachments"] = uploaded_attachments
        result["attachment_upload_errors"] = attachment_upload_errors
        if attachment_upload_errors and not args.allow_attachment_upload_failure:
            result["status"] = "attachment_upload_failed"
            print(json.dumps(result, ensure_ascii=False, indent=2))
            return 8

    try:
        created = post_issue(args.base_url, args.project, token, issue)
    except Exception as exc:
        result["status"] = "submit_failed"
        result["error"] = str(exc)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 4

    requested_labels = set(issue["labels"])
    created_labels = set(created.get("labels") or [])
    missing_after_create = sorted(requested_labels - created_labels)
    label_update_error = None
    if created.get("iid") and missing_after_create:
        try:
            created = update_issue_labels(args.base_url, args.project, created.get("iid"), token, missing_after_create)
        except Exception as exc:
            label_update_error = str(exc)

    final_labels = set(created.get("labels") or [])
    missing_after_submit = sorted(requested_labels - final_labels)
    result["status"] = "submitted"
    result["issue_iid"] = created.get("iid")
    result["issue_url"] = created.get("web_url")
    result["labels_after_submit"] = sorted(final_labels)
    result["missing_labels_after_submit"] = missing_after_submit
    if label_update_error:
        result["label_update_error"] = label_update_error
    if missing_after_submit:
        result["status"] = "submitted_label_mismatch"
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if not missing_after_submit else 7


if __name__ == "__main__":
    sys.exit(main())
