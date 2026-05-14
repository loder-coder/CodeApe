export function shortHash(hash: string) {
  return hash.replace(/[^a-z0-9]/gi, "").slice(0, 4).toLowerCase().padEnd(4, "0");
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
