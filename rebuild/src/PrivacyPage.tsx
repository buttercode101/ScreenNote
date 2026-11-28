import React from "react";
import { ArrowLeft, ShieldCheck, Video } from "lucide-react";
import "./styles.css";

export default function PrivacyPage() {
  return <main className="share-page">
    <header className="share-topbar"><a className="share-brand" href="/"><span className="brand-mark"><Video size={17}/></span> screen<span>note</span></a><span className="temporary-label"><ShieldCheck size={14}/> Private by design</span></header>
    <article className="privacy-document">
      <a className="text-action" href="/"><ArrowLeft size={14}/> Back to ScreenNote</a>
      <span className="eyebrow">PRIVACY, BY DESIGN</span>
      <h1>Your original stays with you.</h1>
      <p className="privacy-lead">ScreenNote is designed for temporary collaboration. Your recording is stored in this browser until you choose to publish a separate shared copy.</p>
      <h2>What stays on your device</h2>
      <p>Recordings, imported videos, unfinished recording chunks and private share recovery keys are stored in your browser's local IndexedDB or local storage. ScreenNote does not upload these items until you explicitly publish a share. Browser storage can be cleared by your browser or device, so download anything you need to keep.</p>
      <h2>What is uploaded</h2>
      <p>When you publish, ScreenNote uploads a copy of the selected video to private Cloudflare R2 storage. The service stores the clip title, media type, file size, duration, expiry, password hash (if set), and the discussion associated with that share. The original local file is not replaced or deleted.</p>
      <h2>Who can watch</h2>
      <p>Anyone with the share link can watch unless you add a password. Viewers do not need an account. Share links are unlisted, not indexed as public content, and should be treated as private to the people you send them to. A password adds another access check but does not prevent a recipient from recording or copying what they can view.</p>
      <h2>Comments and recovery keys</h2>
      <p>Comments are stored with the shared clip and include their timestamp, text, a guest label and a hashed private author key used for editing or deleting. The creator recovery key is generated in your browser and exported only when you request it. Keep that file private: it can manage the corresponding share.</p>
      <h2>When sharing ends</h2>
      <p>Stopping a share deletes its R2 video object and removes the share and discussion records. Links also expire automatically after 1, 3 or 7 days. A scheduled cleanup runs every 15 minutes, so expired media may remain in storage for a short cleanup interval after its expiry time. Video responses are marked private and no-store to prevent normal browser and CDN caching.</p>
      <h2>What we do not do</h2>
      <p>ScreenNote does not require an account to watch, does not maintain a permanent cloud video library, and does not use shared videos for advertising. The development build currently has no analytics or AI processing pipeline.</p>
      <h2>Your responsibilities</h2>
      <p>Only share recordings you have the right to disclose. Avoid recording passwords, financial information or other sensitive material. A recipient can independently save a copy of a video or its contents while they have access; ScreenNote cannot erase copies a recipient has already made.</p>
      <p className="privacy-updated">Last updated: 25 November 2026 · Development privacy notice</p>
    </article>
  </main>;
}
