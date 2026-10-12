'use client';

import type { SkillSibling } from '@skillright/backend';
import { ChevronDown, ChevronRight, FileCode2, FileWarning, Folder, FolderOpen } from 'lucide-react';
import { useMemo, useState } from 'react';
import { SoftPanel } from '@/components/SoftShell';
import { cn } from '@/lib/utils';

const SKILL_MD_KEY = 'skill.md';

type FileEntry = {
  key: string;
  label: string;
  fileType: string;
  sizeBytes: number;
  content: string | null;
};

type DirNode = {
  kind: 'dir';
  name: string;
  path: string;
  children: TreeNode[];
};

type FileNode = {
  kind: 'file';
  name: string;
  path: string;
  entry: FileEntry;
};

type TreeNode = DirNode | FileNode;

function siblingKey(sibling: SkillSibling): string {
  return `${sibling.occurrenceId}:${sibling.relativePath}`;
}

function ensureDir(children: TreeNode[], name: string, path: string): DirNode {
  const existing = children.find((child): child is DirNode => child.kind === 'dir' && child.name === name);
  if (existing) return existing;
  const dir: DirNode = { kind: 'dir', name, path, children: [] };
  children.push(dir);
  return dir;
}

function insertFile(root: TreeNode[], entry: FileEntry, relativePath: string): void {
  const parts = relativePath.split('/').filter(Boolean);
  if (parts.length === 0) return;

  let nodes = root;
  let currentPath = '';

  for (let i = 0; i < parts.length - 1; i += 1) {
    const part = parts[i]!;
    currentPath = currentPath ? `${currentPath}/${part}` : part;
    const dir = ensureDir(nodes, part, currentPath);
    nodes = dir.children;
  }

  const fileName = parts[parts.length - 1]!;
  const filePath = relativePath;
  if (!nodes.some((node) => node.kind === 'file' && node.path === filePath)) {
    nodes.push({ kind: 'file', name: fileName, path: filePath, entry });
  }
}

function sortTree(nodes: TreeNode[]): TreeNode[] {
  return [...nodes]
    .map((node) =>
      node.kind === 'dir' ? { ...node, children: sortTree(node.children) } : node,
    )
    .sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'dir' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

function collectDefaultOpenPaths(nodes: TreeNode[], depth = 0): string[] {
  const open: string[] = [];
  for (const node of nodes) {
    if (node.kind === 'dir') {
      if (depth < 2) open.push(node.path);
      open.push(...collectDefaultOpenPaths(node.children, depth + 1));
    }
  }
  return open;
}

function TreeRows({
  nodes,
  depth,
  selectedKey,
  openDirs,
  onToggleDir,
  onSelect,
}: {
  nodes: TreeNode[];
  depth: number;
  selectedKey: string;
  openDirs: Set<string>;
  onToggleDir: (path: string) => void;
  onSelect: (key: string) => void;
}) {
  return (
    <>
      {nodes.map((node) => {
        if (node.kind === 'dir') {
          const open = openDirs.has(node.path);
          return (
            <li key={`dir:${node.path}`}>
              <button
                type="button"
                onClick={() => onToggleDir(node.path)}
                style={{ paddingLeft: `${0.5 + depth * 0.75}rem` }}
                className="flex w-full items-center gap-1.5 rounded-lg py-1.5 pr-2 text-left text-muted-foreground transition-colors hover:bg-white/70 hover:text-foreground"
              >
                {open ? (
                  <ChevronDown className="size-3.5 shrink-0" />
                ) : (
                  <ChevronRight className="size-3.5 shrink-0" />
                )}
                {open ? (
                  <FolderOpen className="size-3.5 shrink-0 text-amber-600/80" />
                ) : (
                  <Folder className="size-3.5 shrink-0 text-amber-600/80" />
                )}
                <span className="truncate font-mono text-xs">{node.name}</span>
              </button>
              {open ? (
                <ul>
                  <TreeRows
                    nodes={node.children}
                    depth={depth + 1}
                    selectedKey={selectedKey}
                    openDirs={openDirs}
                    onToggleDir={onToggleDir}
                    onSelect={onSelect}
                  />
                </ul>
              ) : null}
            </li>
          );
        }

        const active = node.entry.key === selectedKey;
        return (
          <li key={node.entry.key}>
            <button
              type="button"
              onClick={() => onSelect(node.entry.key)}
              style={{ paddingLeft: `${0.5 + depth * 0.75}rem` }}
              className={cn(
                'flex w-full items-center gap-1.5 rounded-lg py-1.5 pr-2 text-left transition-colors',
                active
                  ? 'bg-white text-foreground shadow-sm ring-1 ring-black/5'
                  : 'text-muted-foreground hover:bg-white/70 hover:text-foreground',
              )}
            >
              <span className="size-3.5 shrink-0" aria-hidden />
              <FileCode2 className="size-3.5 shrink-0" />
              <span className="min-w-0 flex-1 truncate font-mono text-xs">{node.name}</span>
              {node.entry.content === null ? (
                <span className="shrink-0 text-[0.65rem] opacity-70">n/a</span>
              ) : null}
            </button>
          </li>
        );
      })}
    </>
  );
}

export function SkillFilesPanel({
  skillContent,
  siblings,
}: {
  skillContent: string;
  siblings: SkillSibling[];
}) {
  const files = useMemo<FileEntry[]>(() => {
    const skillEntry: FileEntry = {
      key: SKILL_MD_KEY,
      label: 'SKILL.md',
      fileType: 'md',
      sizeBytes: new TextEncoder().encode(skillContent).length,
      content: skillContent,
    };
    return [
      skillEntry,
      ...siblings.map((sibling) => ({
        key: siblingKey(sibling),
        label: sibling.relativePath,
        fileType: sibling.fileType,
        sizeBytes: sibling.sizeBytes,
        content: sibling.content,
      })),
    ];
  }, [skillContent, siblings]);

  const tree = useMemo(() => {
    const skillNode: FileNode = {
      kind: 'file',
      name: 'SKILL.md',
      path: 'SKILL.md',
      entry: files[0]!,
    };
    // Sibling files/dirs sit under SKILL.md in the list (SKILL.md always first).
    const siblingRoot: TreeNode[] = [];
    for (const sibling of siblings) {
      const entry = files.find((file) => file.key === siblingKey(sibling));
      if (entry) insertFile(siblingRoot, entry, sibling.relativePath);
    }
    return [skillNode, ...sortTree(siblingRoot)];
  }, [files, siblings]);

  const [selectedKey, setSelectedKey] = useState<string>(SKILL_MD_KEY);
  const [openDirs, setOpenDirs] = useState<Set<string>>(
    () => new Set(collectDefaultOpenPaths(tree.slice(1))),
  );

  const selected = files.find((file) => file.key === selectedKey) ?? files[0]!;

  function toggleDir(path: string) {
    setOpenDirs((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  return (
    <SoftPanel tone="card">
      <h2 className="mb-1 font-heading text-xl font-bold tracking-tight">Sources</h2>
      <p className="mb-5 text-sm text-muted-foreground">
        SKILL.md and sibling files from this skill package ({files.length} file
        {files.length === 1 ? '' : 's'}).
      </p>

      <div className="grid gap-4 lg:grid-cols-[minmax(14rem,18rem)_1fr]">
        <ul className="max-h-[70vh] overflow-auto rounded-2xl bg-muted/40 p-2 ring-1 ring-black/5">
          <TreeRows
            nodes={tree}
            depth={0}
            selectedKey={selected.key}
            openDirs={openDirs}
            onToggleDir={toggleDir}
            onSelect={setSelectedKey}
          />
        </ul>

        <div className="min-w-0 rounded-2xl bg-white ring-1 ring-border">
          <div className="flex flex-wrap items-center gap-2 border-b border-border/70 px-4 py-3">
            <FileCode2 className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate font-mono text-xs font-medium">{selected.label}</span>
            <span className="text-xs text-muted-foreground">
              {selected.fileType} · {selected.sizeBytes} B
            </span>
          </div>
          {selected.content !== null ? (
            <pre className="max-h-[70vh] overflow-auto p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap">
              {selected.content}
            </pre>
          ) : (
            <div className="flex items-start gap-3 p-5 text-sm text-muted-foreground">
              <FileWarning className="mt-0.5 size-4 shrink-0" />
              <p>
                Content was not stored for this file (binary, unsupported type, or larger than the index
                limit). Re-index the repository if you need it here.
              </p>
            </div>
          )}
        </div>
      </div>
    </SoftPanel>
  );
}
