import { Link } from "react-router";
import { authorName, communityName, relativeTime } from "../../lib/forum";
import { Icon } from "../landing/visuals";

export function PostMeta({ post }) {
  return <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-relaxed text-[#a2a6b7]"><Link to={`/?community=${post.subreddit_id}`} className="font-medium text-[#c1cee5] hover:text-white">{communityName(post)}</Link><span aria-hidden="true">·</span><span className="[overflow-wrap:anywhere]">{authorName(post)}</span><span aria-hidden="true">·</span><time dateTime={post.created_at} title={new Date(post.created_at).toLocaleString()}>{relativeTime(post.created_at)}</time></div>;
}

export default function PostCard({ post }) {
  return <article className="group rounded-xl border border-white/10 bg-[#11131b]/95 p-5 transition-colors hover:border-[#b1bdd1]/30 sm:p-6">
    <PostMeta post={post} />
    <h2 className="mt-3 text-xl leading-snug font-medium tracking-[-.35px] [overflow-wrap:anywhere] sm:text-[24px]"><Link to={`/posts/${post.id}`} className="hover:text-[#ffb09d]">{post.title}</Link></h2>
    <p className="mt-3 line-clamp-3 text-sm leading-[1.85] whitespace-pre-line text-[#b5b7c6] [overflow-wrap:anywhere]">{post.body}</p>
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><Link to={`/posts/${post.id}#comments`} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-white/4 px-3 text-xs text-[#c5c8d3] transition-colors hover:bg-white/8 hover:text-white"><Icon name="chat" size={17} />{Number.isInteger(post.comment_count) ? `${post.comment_count} ${post.comment_count === 1 ? "comment" : "comments"}` : "Read discussion"}</Link><Link to={`/posts/${post.id}`} aria-label={`Read ${post.title}`} className="inline-flex min-h-10 items-center gap-2 text-xs text-[#9ba8bf] hover:text-starlight">Open transmission <Icon name="diagonal" size={15} /></Link></div>
  </article>;
}
