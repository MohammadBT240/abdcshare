#!/usr/bin/env python3
"""Write ansible/inventory/ci.yml for GitHub Actions."""

from __future__ import annotations

import argparse
import os
from pathlib import Path


def yaml_escape_double_quoted(s: str) -> str:
    return s.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")


def write_inventory(group: str, host_alias: str, out_path: Path) -> None:
    host = os.environ["DEPLOY_HOST"]
    user = os.environ["DEPLOY_USER"]
    password = os.environ["DEPLOY_SSH_PASSWORD"]
    become_password = os.environ.get("DEPLOY_SUDO_PASSWORD", "").strip() or password
    port_raw = os.environ.get("DEPLOY_PORT", "").strip() or "22"
    port = int(port_raw)

    def dq(s: str) -> str:
        return f'"{yaml_escape_double_quoted(s)}"'

    # Keepalives prevent CI SSH drops during long first-time docker pulls
    # (worker image especially). 30s × 120 ≈ 60 minutes of silence allowed.
    ssh_args = (
        "-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null "
        "-o ServerAliveInterval=30 -o ServerAliveCountMax=120"
    )

    text = f"""---
# Generated in CI. See ansible/scripts/write_ci_inventory.py
{group}:
  hosts:
    {host_alias}:
      ansible_host: {dq(host)}
      ansible_user: {dq(user)}
      ansible_password: {dq(password)}
      ansible_become_password: {dq(become_password)}
      ansible_ssh_port: {port}
      ansible_ssh_common_args: {dq(ssh_args)}
"""
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(text, encoding="utf-8")


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--group", required=True, help="Inventory group (abdcshare_prod, abdcshare_staging)")
    p.add_argument("--host-alias", dest="host_alias", required=True, help="Host alias (abdcshare-prod)")
    p.add_argument("-o", "--output", type=Path, default=Path("ansible/inventory/ci.yml"))
    args = p.parse_args()
    write_inventory(args.group, args.host_alias, args.output)


if __name__ == "__main__":
    main()
