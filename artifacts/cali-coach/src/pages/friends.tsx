import { useState } from "react";
import { Link } from "wouter";
import { Show } from "@clerk/react";
import { Search, UserPlus, UserCheck, UserX, ExternalLink, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  useMyProfile,
  useFriends,
  useFriendRequests,
  useSearchUsers,
  useSendFriendRequest,
  useRespondToRequest,
  useRemoveFriend,
} from "@/lib/social";
import { getBadge } from "@/lib/badge-status";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

function Avatar({
  name,
  url,
  size = "md",
}: {
  name: string;
  url?: string | null;
  size?: "sm" | "md";
}) {
  const dim = size === "sm" ? "w-8 h-8 text-xs" : "w-10 h-10 text-sm";
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className={cn("rounded-full object-cover shrink-0", dim)}
      />
    );
  }
  return (
    <div
      className={cn(
        "rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary shrink-0",
        dim,
      )}
    >
      {name[0]?.toUpperCase() ?? "?"}
    </div>
  );
}

export function Friends() {
  const [query, setQuery] = useState("");
  const { toast } = useToast();
  const { t } = useTranslation();

  const { data: myProfile, isLoading: profileLoading } = useMyProfile();
  const { data: friends = [], isLoading: friendsLoading } = useFriends();
  const { data: requests, isLoading: requestsLoading } = useFriendRequests();
  const { data: searchResults = [], isLoading: searching } = useSearchUsers(query);
  const sendRequest = useSendFriendRequest();
  const respondRequest = useRespondToRequest();
  const removeFriend = useRemoveFriend();

  const incomingRequests = requests?.incoming ?? [];
  const outgoingRequests = requests?.outgoing ?? [];

  function handleSend(username: string) {
    sendRequest.mutate(username, {
      onSuccess: () =>
        toast({ title: t("friends.requestSentTitle"), description: `@${username}` }),
      onError: (err: Error) =>
        toast({ title: err.message, variant: "destructive" }),
    });
  }

  function handleRespond(id: number, action: "accept" | "reject") {
    respondRequest.mutate(
      { id, action },
      {
        onSuccess: () =>
          toast({
            title: action === "accept" ? t("friends.friendAdded") : t("friends.requestDeclined"),
          }),
        onError: () =>
          toast({ title: t("friends.somethingWentWrong"), variant: "destructive" }),
      },
    );
  }

  function handleRemove(friendId: number, username: string) {
    removeFriend.mutate(friendId, {
      onSuccess: () =>
        toast({ title: t("friends.friendRemoved"), description: `@${username}` }),
      onError: () =>
        toast({ title: t("friends.somethingWentWrong"), variant: "destructive" }),
    });
  }

  const outgoingUsernames = new Set(outgoingRequests.map((r) => r.user?.username));
  const friendUsernames = new Set(friends.map((f) => f.username));

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Users className="w-6 h-6 text-primary" />
        {t("friends.title")}
      </h1>

      {/* Sign-in gate */}
      <Show when="signed-out">
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-semibold mb-2">{t("friends.signInTitle")}</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {t("friends.signInDesc")}
          </p>
          <Link
            href="/sign-in"
            className="inline-block px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            {t("common.signIn")}
          </Link>
        </div>
      </Show>

      <Show when="signed-in">
        {/* Profile not yet set up */}
        {!profileLoading && !myProfile && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 mb-6 text-sm text-amber-300">
            {t("friends.profileSetupWarning")}
          </div>
        )}

        {/* ── Search ── */}
        <section className="mb-6">
          <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide block mb-2">
            {t("friends.findAthletes")}
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("friends.searchPlaceholder")}
              className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Search results */}
          {query.trim().length >= 2 && (
            <div className="mt-2 rounded-xl border border-border bg-card overflow-hidden">
              {searching && (
                <div className="p-4 text-sm text-muted-foreground text-center">
                  {t("friends.searching")}
                </div>
              )}
              {!searching && searchResults.length === 0 && (
                <div className="p-4 text-sm text-muted-foreground text-center">
                  {t("friends.noUsersFound", { query })}
                </div>
              )}
              {!searching &&
                searchResults.map((user, i) => {
                  const isAlreadyFriend = friendUsernames.has(user.username);
                  const isPending = outgoingUsernames.has(user.username);
                  return (
                    <div
                      key={user.id}
                      className={cn(
                        "flex items-center gap-3 p-3",
                        i !== 0 && "border-t border-border",
                      )}
                    >
                      <Avatar name={user.displayName} url={user.avatarUrl} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{user.displayName}</div>
                        <div className="text-xs text-muted-foreground">
                          @{user.username}
                        </div>
                      </div>
                      {isAlreadyFriend ? (
                        <span className="text-xs text-primary font-medium flex items-center gap-1">
                          <UserCheck className="w-3.5 h-3.5" />
                          {t("friends.friendsBadge")}
                        </span>
                      ) : isPending ? (
                        <span className="text-xs text-muted-foreground">
                          {t("friends.pending")}
                        </span>
                      ) : (
                        <button
                          onClick={() => handleSend(user.username)}
                          disabled={sendRequest.isPending}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors disabled:opacity-50"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          {t("friends.add")}
                        </button>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </section>

        {/* ── Incoming Requests ── */}
        {!requestsLoading && incomingRequests.length > 0 && (
          <section className="mb-6">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              {t("friends.pendingRequestsCount", { count: incomingRequests.length })}
            </h2>
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              {incomingRequests.map((req, i) => (
                <div
                  key={req.id}
                  className={cn(
                    "flex items-center gap-3 p-3",
                    i !== 0 && "border-t border-border",
                  )}
                >
                  <Avatar
                    name={req.user?.displayName ?? "?"}
                    url={req.user?.avatarUrl}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">
                      {req.user?.displayName}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      @{req.user?.username}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleRespond(req.id, "accept")}
                      disabled={respondRequest.isPending}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      {t("friends.accept")}
                    </button>
                    <button
                      onClick={() => handleRespond(req.id, "reject")}
                      disabled={respondRequest.isPending}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-border text-xs font-medium hover:bg-secondary transition-colors disabled:opacity-50"
                    >
                      <UserX className="w-3.5 h-3.5" />
                      {t("friends.decline")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Outgoing Pending ── */}
        {!requestsLoading && outgoingRequests.length > 0 && (
          <section className="mb-6">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              {t("friends.sentRequestsCount", { count: outgoingRequests.length })}
            </h2>
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              {outgoingRequests.map((req, i) => (
                <div
                  key={req.id}
                  className={cn(
                    "flex items-center gap-3 p-3",
                    i !== 0 && "border-t border-border",
                  )}
                >
                  <Avatar
                    name={req.user?.displayName ?? "?"}
                    url={req.user?.avatarUrl}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">
                      {req.user?.displayName}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      @{req.user?.username}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground px-2 py-1 rounded-full border border-border">
                    {t("friends.pending")}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Friends List ── */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            {t("friends.myFriends")}{friends.length > 0 ? ` (${friends.length})` : ""}
          </h2>

          {friendsLoading ? (
            <div className="rounded-xl border border-border bg-card p-6 flex items-center justify-center">
              <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          ) : friends.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center">
              <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                {t("friends.noFriendsYet")}
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              {friends.map((friend, i) => {
                const badge = getBadge(friend.masteredSkillsCount ?? 0);
                return (
                <div
                  key={friend.id}
                  className={cn(
                    "flex items-center gap-3 p-3",
                    i !== 0 && "border-t border-border",
                  )}
                >
                  <Avatar name={friend.displayName} url={friend.avatarUrl} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-medium text-sm">{friend.displayName}</span>
                      {badge && (
                        <span className={cn(
                          "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold border",
                          badge.bgColor, badge.textColor, badge.borderColor,
                        )}>
                          <span className="text-[9px]">{badge.icon}</span>
                          {badge.label}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      @{friend.username}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/profile/${friend.username}`}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-border text-xs font-medium hover:bg-secondary transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                      {t("common.view")}
                    </Link>
                    <button
                      onClick={() =>
                        handleRemove(friend.id, friend.username)
                      }
                      className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      title={t("friends.removeFriend")}
                    >
                      <UserX className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ); })}
            </div>
          )}
        </section>
      </Show>
    </div>
  );
}
