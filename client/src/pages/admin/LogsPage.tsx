import { Fragment, useState } from "react";
import { useQuery } from "@tanstack/react-query";

interface AppLog {
  id: number;
  createdAt: string;
  level: string;
  source: string;
  message: string;
  requestId?: string;
  method?: string;
  path?: string;
  status?: number;
  durationMs?: number;
  attrs?: Record<string, unknown>;
}

interface LogsResponse {
  logs: AppLog[];
  nextCursor: number | null;
  droppedCount: number;
}

const LEVELS = ["", "INFO", "WARN", "ERROR"];
const SOURCES = ["", "http", "external", "app"];
const RANGES: { label: string; hours: number }[] = [
  { label: "Last 1h", hours: 1 },
  { label: "Last 24h", hours: 24 },
  { label: "Last 7d", hours: 168 },
];

function levelClass(level: string): string {
  switch (level) {
    case "ERROR":
      return "bg-red-100 text-red-700";
    case "WARN":
      return "bg-amber-100 text-amber-700";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

export default function LogsPage() {
  const [level, setLevel] = useState("");
  const [source, setSource] = useState("");
  const [search, setSearch] = useState("");
  const [rangeHours, setRangeHours] = useState(24);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [traceId, setTraceId] = useState<string | null>(null);

  const after = new Date(Date.now() - rangeHours * 3600 * 1000).toISOString();

  const params = new URLSearchParams();
  if (level) params.set("level", level);
  if (source) params.set("source", source);
  if (search) params.set("q", search);
  params.set("after", after);
  params.set("limit", "100");

  const { data, isLoading, isError, refetch } = useQuery<LogsResponse>({
    queryKey: traceId
      ? ["admin-logs-trace", traceId]
      : ["admin-logs", level, source, search, rangeHours],
    queryFn: async () => {
      const url = traceId
        ? `/api/admin/logs/${encodeURIComponent(traceId)}`
        : `/api/admin/logs?${params.toString()}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      const json = await res.json();
      return {
        logs: json.logs ?? [],
        nextCursor: json.nextCursor ?? null,
        droppedCount: json.droppedCount ?? 0,
      };
    },
  });

  const logs = data?.logs ?? [];

  return (
    <div data-testid="logs-page" className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Logs</h2>
        <button
          onClick={() => refetch()}
          className="px-3 py-1.5 text-sm rounded-md border bg-white hover:bg-gray-50"
        >
          Refresh
        </button>
      </div>

      {data && data.droppedCount > 0 && (
        <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
          {data.droppedCount} log entries were dropped due to high volume.
        </div>
      )}

      {traceId && (
        <div className="flex items-center justify-between rounded-md bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-800">
          <span>
            Showing trace for request{" "}
            <code className="font-mono">{traceId}</code>
          </span>
          <button
            onClick={() => {
              setTraceId(null);
              setExpandedId(null);
            }}
            className="px-2 py-1 rounded border bg-white hover:bg-gray-50"
          >
            Back to all logs
          </button>
        </div>
      )}

      <div className={`flex flex-wrap gap-2 ${traceId ? "hidden" : ""}`}>
        <select
          value={level}
          onChange={(e) => setLevel(e.target.value)}
          className="border rounded-md px-2 py-1 text-sm"
        >
          {LEVELS.map((l) => (
            <option key={l} value={l}>
              {l || "All levels"}
            </option>
          ))}
        </select>
        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="border rounded-md px-2 py-1 text-sm"
        >
          {SOURCES.map((s) => (
            <option key={s} value={s}>
              {s || "All sources"}
            </option>
          ))}
        </select>
        <select
          value={rangeHours}
          onChange={(e) => setRangeHours(Number(e.target.value))}
          className="border rounded-md px-2 py-1 text-sm"
        >
          {RANGES.map((r) => (
            <option key={r.hours} value={r.hours}>
              {r.label}
            </option>
          ))}
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search message/path"
          className="border rounded-md px-2 py-1 text-sm flex-1 min-w-[160px]"
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : isError ? (
        <p className="text-sm text-red-600">Failed to load logs.</p>
      ) : logs.length === 0 ? (
        <p className="text-sm text-gray-500">No logs captured.</p>
      ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">Level</th>
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Message</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <Fragment key={log.id}>
                  <tr
                    onClick={() =>
                      setExpandedId(expandedId === log.id ? null : log.id)
                    }
                    className="border-t cursor-pointer hover:bg-gray-50"
                  >
                    <td className="px-3 py-2 whitespace-nowrap text-gray-500">
                      {new Date(log.createdAt).toLocaleTimeString()}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${levelClass(log.level)}`}
                      >
                        {log.level}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-600">{log.source}</td>
                    <td className="px-3 py-2 text-gray-600">
                      {log.status ?? ""}
                    </td>
                    <td className="px-3 py-2 text-gray-900">
                      <div className="truncate max-w-[320px]">
                        {log.message}
                        {log.path ? (
                          <span className="text-gray-400"> {log.path}</span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                  {expandedId === log.id && (
                    <tr className="border-t bg-gray-50">
                      <td colSpan={5} className="px-3 py-2">
                        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                          {log.method && (
                            <>
                              <dt className="text-gray-400">Method</dt>
                              <dd>{log.method}</dd>
                            </>
                          )}
                          {log.path && (
                            <>
                              <dt className="text-gray-400">Path</dt>
                              <dd>{log.path}</dd>
                            </>
                          )}
                          {typeof log.durationMs === "number" && (
                            <>
                              <dt className="text-gray-400">Duration</dt>
                              <dd>{log.durationMs} ms</dd>
                            </>
                          )}
                          {log.requestId && (
                            <>
                              <dt className="text-gray-400">Request ID</dt>
                              <dd>
                                {traceId ? (
                                  <span className="font-mono">
                                    {log.requestId}
                                  </span>
                                ) : (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setTraceId(log.requestId!);
                                      setExpandedId(null);
                                    }}
                                    className="font-mono text-rose-600 hover:underline"
                                  >
                                    {log.requestId} — view trace
                                  </button>
                                )}
                              </dd>
                            </>
                          )}
                        </dl>
                        {log.attrs && (
                          <pre className="mt-2 bg-white border rounded p-2 overflow-x-auto text-xs">
                            {JSON.stringify(log.attrs, null, 2)}
                          </pre>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
