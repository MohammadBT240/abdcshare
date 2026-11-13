---
title: Troubleshooting
summary: What to do when you can't sign in, an email doesn't arrive, you can't see something, an upload fails or a file won't open.
order: 3
related: [faq, signing-in, notifications, who-can-do-what]
---

## Signing in

### "Invalid credentials"

The email or password doesn't match an active account.

- Check the email address — it's the one your invitation was sent to.
- Passwords are case-sensitive. Check Caps Lock.
- Still stuck? Click **Forgot password?** on the sign-in page. If you used to be able to sign in and now can't, your account may have been deactivated — ask an administrator.

### "Your organisation's portal access is switched off"

You're a client contact and the firm has deactivated your organisation in the portal. Your password is fine — contact the firm and ask them to reactivate it.

### I'm asked to change my password before I can continue

That's expected the first time you sign in, and after an administrator resets your password: the temporary password has to be replaced with your own. See [Signing in](help:signing-in).

### I was signed out unexpectedly

Changing or resetting your password signs you out on every device, so sign in again with the new password. Sessions also end when an account is deactivated.

## Emails

### The invitation or password-reset email didn't arrive

1. Wait a few minutes and check your junk or spam folder.
2. Ask an administrator to **Reset & email password** for you — a fresh email is sent.

> [!NOTE]
> **For Platform Admins:** if emails aren't reaching anyone, open [Background jobs](help:background-jobs). Failed or stuck `notification.email` rows show the error; fix the cause and **Re-drive** them.

### I'm not getting notification emails

Check **Settings → Notifications** — **Email** may be unticked for that kind of notification. See [Notifications](help:notifications).

## Can't see something

### A menu item or page is missing

The menu only shows what your role allows. [Who can do what](help:who-can-do-what) lists every action and the roles that can do it. If you need more access, ask an administrator.

### I can't find an engagement or request

- **Staff** only see engagements they're on the team of; **client contacts** only see engagements they've been added to. Ask the engagement's Lead or a Super Admin.
- Check the filters on **Engagements** or **Requests** — a status or stage filter may be hiding it.
- Search (**Ctrl + K**, or **⌘ K** on a Mac) only finds things you're allowed to see.

### A Library item has disappeared

It may have been archived by its uploader or a curator, restricted to another department, or removed after a problem report. Ask a curator — see [Curating the Library](help:library-curating).

## Uploads

### "File must be … or smaller"

Upload limits depend on where you upload:

| Where | Limit |
| --- | --- |
| Client responses, discussion attachments, working papers and final reports | 5 GB per file |
| Library items, planning documents and company profiles | 100 MB per file |
| Profile photos | 2 MB |
| Images in help articles | 5 MB |

### "Unsupported file type"

Some places only accept certain kinds of file — planning documents and company profiles take PDF, Word and Excel; the Library also takes PowerPoint, images, TXT and CSV; profile photos take JPEG, PNG or WebP. Save the file in one of those formats and try again.

### An upload stopped part-way

Files that finished uploading are already saved. For a client response, open the request and use **Continue response** or **Retry failed uploads** and re-attach only what didn't finish. See [Responding to a request](help:responding-to-a-request#if-your-upload-is-interrupted).

## Opening files

### "Checking for viruses…" in the Library

Every new Library file is virus-checked before it can be downloaded — usually within seconds. If it says **Virus check failed**, the curators have been alerted; replacing the file starts a new check.

### A file won't preview

Word, Excel and PowerPoint files are converted for the in-browser viewer, which can take a moment the first time. If a file still can't be shown, download it and open it on your computer — unless it's **view-only** in the Library, in which case ask the uploader or a curator.
