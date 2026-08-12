"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  IconArrowBackUp,
  IconAt,
  IconMessage,
  IconPaperclip,
  IconPencil,
  IconSend,
  IconX,
} from "@tabler/icons-react";
import { toast } from "sonner";
import type { SubmissionStatus } from "@abdcshare/shared";
import { UserAvatar } from "@/components/data/user-avatar";
import { FileTypeIcon } from "@/components/data/file-type-icon";
import { StatusPill, formatStatusLabel, resolveStatusTone } from "@/components/data";
import { FormDialog, LoadingButton } from "@/components/forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import type { EngagementTeamMember } from "@/features/engagements/hooks/use-engagements";
import type { RequestListItem } from "@/features/requests/hooks/use-requests";
import {
  type DiscussionFileRef,
  type DiscussionMessage,
  uploadMessageAttachment,
  useEditMessage,
  useMarkRead,
  useMessages,
  usePostMessage,
} from "@/features/discussions/hooks/use-discussions";
import { BffClientError } from "@/lib/bff/client";
import { cn } from "@/lib/utils";

export interface DiscussFileSeed {
  id: string;
  fileName: string;
  status: SubmissionStatus;
  submissionId: string;
}

interface RequestDiscussionTabProps {
  requestId: string;
  teamMembers: EngagementTeamMember[];
  assignees: RequestListItem["assignees"];
  currentUserId?: string;
  canParticipate: boolean;
  active: boolean;
  /** Prefill composer with a tagged submission file (from Submissions tab). */
  initialReferencedFile?: DiscussFileSeed | null;
  onInitialReferencedFileConsumed?: () => void;
}

interface MentionCandidate {
  userId: string;
  fullName: string;
  email?: string;
  avatarUrl?: string;
}

function formatFileSize(bytes?: number | null): string | null {
  if (bytes == null) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof BffClientError || error instanceof Error
    ? error.message
    : fallback;
}

export function RequestDiscussionTab({
  requestId,
  teamMembers,
  assignees,
  currentUserId,
  canParticipate,
  active,
  initialReferencedFile,
  onInitialReferencedFileConsumed,
}: RequestDiscussionTabProps) {
  const messages = useMessages(requestId, canParticipate && active);
  const postMessage = usePostMessage();
  const editMessage = useEditMessage();
  const markRead = useMarkRead();
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<DiscussionMessage | null>(null);
  const [selectedMentionIds, setSelectedMentionIds] = useState<string[]>([]);
  const [referencedFiles, setReferencedFiles] = useState<DiscussFileSeed[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [editing, setEditing] = useState<DiscussionMessage | null>(null);
  const [editBody, setEditBody] = useState("");
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageRefs = useRef(new Map<string, HTMLElement>());
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!initialReferencedFile) return;
    setReferencedFiles((prev) =>
      prev.some((f) => f.id === initialReferencedFile.id)
        ? prev
        : [...prev, initialReferencedFile],
    );
    onInitialReferencedFileConsumed?.();
  }, [initialReferencedFile, onInitialReferencedFileConsumed]);

  const thread = useMemo(
    () =>
      [...(messages.data?.data ?? [])].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() ||
          b.id.localeCompare(a.id),
      ),
    [messages.data?.data],
  );
  const byId = useMemo(
    () => new Map(thread.map((message) => [message.id, message])),
    [thread],
  );
  const latestMessageId = thread[0]?.id;

  const mentionCandidates = useMemo(() => {
    const candidates = new Map<string, MentionCandidate>();
    for (const member of teamMembers) {
      candidates.set(member.userId, {
        userId: member.userId,
        fullName: member.fullName,
        email: member.email,
        avatarUrl: member.avatarUrl,
      });
    }
    for (const assignee of assignees) {
      if (!candidates.has(assignee.userId)) {
        candidates.set(assignee.userId, assignee);
      }
    }
    return [...candidates.values()].sort((a, b) =>
      a.fullName.localeCompare(b.fullName),
    );
  }, [assignees, teamMembers]);

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    };
  }, []);

  function scrollToMessage(messageId: string) {
    const target = messageRefs.current.get(messageId);
    if (!target) {
      toast.error("Original message is not available in this view");
      return;
    }
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedId(messageId);
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => {
      setHighlightedId(null);
      highlightTimerRef.current = null;
    }, 1800);
  }

  useEffect(() => {
    if (!active || !canParticipate) return;
    const markLatestRead = () => {
      if (document.visibilityState === "visible") {
        markRead.mutate({ requestId, lastReadMessageId: latestMessageId });
      }
    };
    markLatestRead();
    window.addEventListener("focus", markLatestRead);
    document.addEventListener("visibilitychange", markLatestRead);
    return () => {
      window.removeEventListener("focus", markLatestRead);
      document.removeEventListener("visibilitychange", markLatestRead);
    };
    // The mutation is intentionally repeated when the latest message changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, canParticipate, latestMessageId, requestId]);

  function selectMention(candidate: MentionCandidate) {
    setSelectedMentionIds((ids) =>
      ids.includes(candidate.userId) ? ids : [...ids, candidate.userId],
    );
    setBody(
      (value) =>
        `${value}${value && !value.endsWith(" ") ? " " : ""}@${candidate.fullName} `,
    );
    setMentionOpen(false);
  }

  async function handlePost() {
    const trimmed = body.trim();
    if (!trimmed) {
      toast.error("Enter a message");
      return;
    }
    try {
      const created = await postMessage.mutateAsync({
        requestId,
        body: trimmed,
        parentMessageId: replyTo?.id,
        mentionUserIds: selectedMentionIds.length
          ? selectedMentionIds
          : undefined,
        referencedFileIds: referencedFiles.length
          ? referencedFiles.map((f) => f.id)
          : undefined,
      });
      const pendingFiles = files;
      setBody("");
      setReplyTo(null);
      setSelectedMentionIds([]);
      setReferencedFiles([]);
      setFiles([]);

      if (pendingFiles.length > 0) {
        const results = await Promise.allSettled(
          pendingFiles.map((file) => uploadMessageAttachment(created.id, file)),
        );
        const failed = results.filter(
          (result) => result.status === "rejected",
        ).length;
        if (failed > 0) {
          toast.error(
            `${failed} attachment${failed === 1 ? "" : "s"} failed to upload`,
          );
        }
        await messages.refetch();
      }
    } catch (error) {
      toast.error(errorMessage(error, "Failed to post message"));
    }
  }

  async function handleEdit() {
    if (!editing || !editBody.trim()) return;
    try {
      await editMessage.mutateAsync({
        id: editing.id,
        requestId,
        body: editBody.trim(),
      });
      setEditing(null);
      toast.success("Message updated");
    } catch (error) {
      toast.error(errorMessage(error, "Failed to update message"));
    }
  }

  if (!canParticipate) {
    return (
      <div className="rounded-md border border-dashed border-border px-6 py-10 text-center">
        <p className="text-sm font-medium">Discussion unavailable</p>
        <p className="mt-1 text-sm text-muted-foreground">
          You do not have permission to participate in this discussion.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold">Discussion</h2>
        <p className="text-sm text-muted-foreground">
          Keep request decisions, questions, and files in one thread.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="border-b border-border bg-muted/30 p-3 sm:p-4">
          {replyTo ? (
            <div className="mb-3 flex items-start justify-between gap-3 rounded-md border border-border bg-card px-3 py-2">
              <button
                type="button"
                className="min-w-0 flex-1 rounded-sm text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => scrollToMessage(replyTo.id)}
              >
                <p className="text-xs font-medium">
                  Replying to {replyTo.authorName || "Unknown user"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {replyTo.body}
                </p>
              </button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 shrink-0 p-0"
                aria-label="Cancel reply"
                onClick={() => setReplyTo(null)}
              >
                <IconX className="h-4 w-4" />
              </Button>
            </div>
          ) : null}

          {selectedMentionIds.length > 0 ? (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {selectedMentionIds.map((id) => {
                const candidate = mentionCandidates.find(
                  (person) => person.userId === id,
                );
                return candidate ? (
                  <Badge key={id} variant="secondary" className="gap-1 pr-1">
                    @{candidate.fullName}
                    <button
                      type="button"
                      aria-label={`Remove ${candidate.fullName} mention`}
                      onClick={() =>
                        setSelectedMentionIds((ids) =>
                          ids.filter((mentionId) => mentionId !== id),
                        )
                      }
                    >
                      <IconX className="h-3 w-3" />
                    </button>
                  </Badge>
                ) : null;
              })}
            </div>
          ) : null}

          {referencedFiles.length > 0 ? (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {referencedFiles.map((file) => (
                <Badge
                  key={file.id}
                  variant="outline"
                  className="gap-1.5 pr-1 font-normal"
                >
                  <FileTypeIcon fileName={file.fileName} size={14} />
                  <span className="max-w-[10rem] truncate">{file.fileName}</span>
                  <StatusPill
                    tone={resolveStatusTone(file.status)}
                    className="h-4 px-1.5 text-[9px]"
                  >
                    {formatStatusLabel(file.status)}
                  </StatusPill>
                  <button
                    type="button"
                    className="rounded-sm p-0.5 hover:bg-muted"
                    aria-label={`Remove file tag ${file.fileName}`}
                    onClick={() =>
                      setReferencedFiles((prev) =>
                        prev.filter((f) => f.id !== file.id),
                      )
                    }
                  >
                    <IconX className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          ) : null}

          {files.length > 0 ? (
            <div className="mb-2 flex flex-wrap gap-2">
              {files.map((file, index) => (
                <Badge
                  key={`${file.name}-${index}`}
                  variant="outline"
                  className="gap-1 pr-1"
                >
                  <FileTypeIcon
                    fileName={file.name}
                    mimeType={file.type}
                    size={14}
                  />
                  <span className="max-w-52 truncate">{file.name}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${file.name}`}
                    onClick={() =>
                      setFiles((items) =>
                        items.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                  >
                    <IconX className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          ) : null}

          <Textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                void handlePost();
              }
            }}
            rows={3}
            className="resize-y bg-card"
            placeholder="Write a message…"
            disabled={postMessage.isPending}
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <Popover open={mentionOpen} onOpenChange={setMentionOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="ghost" size="sm">
                    <IconAt className="mr-1.5 h-4 w-4" />
                    Mention
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-80">
                  <Command>
                    <CommandInput placeholder="Find a team member…" />
                    <CommandList>
                      <CommandEmpty>No team members found.</CommandEmpty>
                      <CommandGroup>
                        {mentionCandidates.map((candidate) => (
                          <CommandItem
                            key={candidate.userId}
                            value={`${candidate.fullName} ${candidate.email ?? ""}`}
                            onSelect={() => selectMention(candidate)}
                          >
                            <UserAvatar
                              src={candidate.avatarUrl}
                              initials={candidate.fullName.slice(0, 2)}
                              size="sm"
                              className="mr-2 h-7 w-7"
                            />
                            <span className="min-w-0">
                              <span className="block truncate">
                                {candidate.fullName}
                              </span>
                              {candidate.email ? (
                                <span className="block truncate text-xs text-muted-foreground">
                                  {candidate.email}
                                </span>
                              ) : null}
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.gif,.webp,.zip,.mp4,.mov,application/pdf,application/zip,application/x-zip-compressed,image/*,video/*,text/*"
                className="hidden"
                onChange={(event) => {
                  setFiles((items) => [
                    ...items,
                    ...Array.from(event.target.files ?? []),
                  ]);
                  event.target.value = "";
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <IconPaperclip className="mr-1.5 h-4 w-4" />
                Attach
              </Button>
            </div>
            <LoadingButton
              type="button"
              size="sm"
              loading={postMessage.isPending}
              disabled={!body.trim()}
              onClick={handlePost}
            >
              <IconSend className="mr-1.5 h-4 w-4" />
              Post
            </LoadingButton>
          </div>
        </div>

        <div className="max-h-[34rem] min-h-64 overflow-y-auto px-4 py-2 sm:px-5">
          {messages.isPending ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Loading discussion…
            </p>
          ) : messages.isError ? (
            <p className="py-10 text-center text-sm text-destructive">
              {errorMessage(messages.error, "Failed to load discussion")}
            </p>
          ) : thread.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm font-medium">Start the discussion</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Post the first message or mention someone who can help.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {thread.map((message) => (
                <MessageRow
                  key={message.id}
                  message={message}
                  parent={
                    message.parentMessageId
                      ? byId.get(message.parentMessageId)
                      : undefined
                  }
                  ownMessage={message.authorId === currentUserId}
                  highlighted={highlightedId === message.id}
                  registerRef={(node) => {
                    if (node) messageRefs.current.set(message.id, node);
                    else messageRefs.current.delete(message.id);
                  }}
                  onReply={() => setReplyTo(message)}
                  onEdit={() => {
                    setEditing(message);
                    setEditBody(message.body);
                  }}
                  onJumpToParent={
                    message.parentMessageId
                      ? () => scrollToMessage(message.parentMessageId!)
                      : undefined
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <FormDialog
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
        title="Edit message"
        maxWidthClass="sm:max-w-lg"
        footer={
          <LoadingButton
            type="button"
            loading={editMessage.isPending}
            disabled={!editBody.trim()}
            onClick={handleEdit}
          >
            Save changes
          </LoadingButton>
        }
      >
        <Textarea
          value={editBody}
          onChange={(event) => setEditBody(event.target.value)}
          rows={5}
        />
      </FormDialog>
    </div>
  );
}

function ReferencedFileChip({ fileRef }: { fileRef: DiscussionFileRef }) {
  return (
    <div
      className="flex max-w-full items-center gap-2 rounded-md border border-border bg-muted/30 px-2.5 py-1.5 text-xs"
      title={`Status when discussed: ${formatStatusLabel(fileRef.statusAtPost)}`}
    >
      <IconMessage className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <FileTypeIcon fileName={fileRef.fileName} size={16} />
      <span className="min-w-0 truncate font-medium">{fileRef.fileName}</span>
      <StatusPill
        tone={resolveStatusTone(fileRef.statusAtPost)}
        className="h-5 shrink-0 px-2 text-[10px]"
      >
        {formatStatusLabel(fileRef.statusAtPost)}
      </StatusPill>
      <span className="hidden shrink-0 text-[10px] text-muted-foreground sm:inline">
        at post
      </span>
    </div>
  );
}

function MessageRow({
  message,
  parent,
  ownMessage,
  highlighted,
  registerRef,
  onReply,
  onEdit,
  onJumpToParent,
}: {
  message: DiscussionMessage;
  parent?: DiscussionMessage;
  ownMessage: boolean;
  highlighted: boolean;
  registerRef: (node: HTMLElement | null) => void;
  onReply: () => void;
  onEdit: () => void;
  onJumpToParent?: () => void;
}) {
  const authorName = message.authorName || "Unknown user";
  return (
    <article
      ref={registerRef}
      data-message-id={message.id}
      className={cn(
        "group flex gap-3 rounded-md px-1 py-4 transition-colors duration-500",
        highlighted && "bg-primary/10 ring-1 ring-primary/25",
      )}
    >
      <UserAvatar
        src={message.authorAvatarUrl}
        initials={authorName.slice(0, 2)}
        size="sm"
        className="shrink-0"
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <p className="text-sm font-medium">{authorName}</p>
          <time
            className="text-xs text-muted-foreground"
            dateTime={message.createdAt}
          >
            {new Date(message.createdAt).toLocaleString()}
          </time>
          {message.editedAt ? (
            <span className="text-xs text-muted-foreground">(edited)</span>
          ) : null}
        </div>
        {parent && onJumpToParent ? (
          <button
            type="button"
            onClick={onJumpToParent}
            className="mt-2 w-full rounded-md border border-border bg-muted/40 px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Jump to message from ${parent.authorName || "Unknown user"}`}
          >
            <span className="font-medium text-foreground/80">
              {parent.authorName || "Unknown user"}:{" "}
            </span>
            <span className="line-clamp-2 whitespace-pre-wrap">
              {parent.body}
            </span>
          </button>
        ) : message.parentMessageId ? (
          <p className="mt-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            Reply to an earlier message
          </p>
        ) : null}
        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">
          {message.body}
        </p>
        {(message.referencedFiles?.length ?? 0) > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {message.referencedFiles.map((ref) => (
              <li key={ref.id}>
                <ReferencedFileChip fileRef={ref} />
              </li>
            ))}
          </ul>
        ) : null}
        {message.attachments.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {message.attachments.map((attachment) => (
              <li
                key={attachment.id}
                className="flex max-w-full items-center gap-2 rounded-md border border-border bg-muted/30 px-2.5 py-1.5 text-xs"
              >
                <FileTypeIcon
                  fileName={attachment.fileName}
                  mimeType={attachment.mimeType}
                  size={16}
                />
                <span className="truncate">{attachment.fileName}</span>
                {formatFileSize(attachment.sizeBytes) ? (
                  <span className="shrink-0 text-muted-foreground">
                    {formatFileSize(attachment.sizeBytes)}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mt-2 flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={onReply}
          >
            <IconArrowBackUp className="mr-1 h-3.5 w-3.5" />
            Reply
          </Button>
          {ownMessage ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={onEdit}
            >
              <IconPencil className="mr-1 h-3.5 w-3.5" />
              Edit
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
