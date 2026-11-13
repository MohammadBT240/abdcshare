#!/usr/bin/env python3
"""Write ansible/inventory/ci.yml for GitHub Actions.

Authentication (S4): a dedicated deploy SSH key is preferred — set DEPLOY_SSH_KEY_FILE (the workflow
writes the DEPLOY_SSH_KEY secret to a 0600 file). DEPLOY_KNOWN_HOSTS (the VM's host key line) turns on
strict host-key checking. DEPLOY_SSH_PASSWORD is only a fallback while the key is being rolled out.
sudo still needs DEPLOY_SUDO_PASSWORD (or the SSH password) unless the deploy user has NOPASSWD.
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path


def yaml_escape_double_quoted(s: str) -> str:
    return s.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")


def write_inventory(group: str, host_alias: str, out_path: Path) -> None:
    host = os.environ["DEPLOY_HOST"]
    user = os.environ["DEPLOY_USER"]
    key_file = os.environ.get("DEPLOY_SSH_KEY_FILE", "").strip()
    password = os.environ.get("DEPLOY_SSH_PASSWORD", "").strip()
    known_hosts = os.environ.get("DEPLOY_KNOWN_HOSTS_FILE", "").strip()
    if not key_file and not password:
        raise SystemExit("Set DEPLOY_SSH_KEY (preferred) or DEPLOY_SSH_PASSWORD")
    become_password = os.environ.get("DEPLOY_SUDO_PASSWORD", "").strip() or password
    port_raw = os.environ.get("DEPLOY_PORT", "").strip() or "22"
    port = int(port_raw)

    def dq(s: str) -> str:
        return f'"{yaml_escape_double_quoted(s)}"'

    # Keepalives prevent CI SSH drops during long first-time docker pulls
    # (worker image especially). 30s × 120 ≈ 60 minutes of silence allowed.
    host_keys = (
        f"-o StrictHostKeyChecking=yes -o UserKnownHostsFile={known_hosts} "
        if known_hosts
        else "-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null "
    )
    ssh_args = host_keys + "-o ServerAliveInterval=30 -o ServerAliveCountMax=120"
    if key_file:
        # Key auth only — never fall back to a password once the key is in place.
        ssh_args += " -o PasswordAuthentication=no -o PreferredAuthentications=publickey"
        auth = f"      ansible_ssh_private_key_file: {dq(key_file)}\n"
    else:
        print("WARNING: deploying with SSH password auth — add the DEPLOY_SSH_KEY secret (docs/DEPLOYMENT.md §8d)")
        auth = f"      ansible_password: {dq(password)}\n"
    become = f"      ansible_become_password: {dq(become_password)}\n" if become_password else ""

    text = f"""---
# Generated in CI. See ansible/scripts/write_ci_inventory.py
{group}:
  hosts:
    {host_alias}:
      ansible_host: {dq(host)}
      ansible_user: {dq(user)}
{auth}{become}      ansible_ssh_port: {port}
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
