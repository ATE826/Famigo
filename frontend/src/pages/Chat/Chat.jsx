import DeleteMessageDialog from "./DeleteMessageDialog";
import Recorder from "./Recorder";
import MessageMenu from "../../components/ChatShare/MessageMenu";
import Attachments from "../../components/ChatShare/Attachments";
import AttachmentDraft from "./AttachmentDraft";
import useAttachmentDraft from "./useAttachmentDraft";
import ChatShare from "../../components/ChatShare/ChatShare";
import MessageContent from "../../components/ChatShare/MessageContent";
import MediaViewer from "../../components/ChatShare/MediaViewer";
import MessagePresence from "./MessagePresence";
import useChatViewport from "./useChatViewport";
import {errorText} from "../../api/client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import Avatar from "../../components/Avatar/Avatar";
import Icon from "../../components/Icon/Icon";
import { useData } from "../../store/DataContext";
import { GROUP_CHAT_ID } from "../../utils/chats";
import { roleLabels } from "../../utils/roles";
import { t } from "../../i18n";
import { TODAY, addDays, dateKey, dayTitle } from "../Calendar/data";
import styles from "./Chat.module.css";
import useMessageViews from './useMessageViews';

// Restore the exact history entry when returning from a member's profile.
const profileReturnPositions = new Map();

// «Сегодня», «Вчера» или дата — над первым сообщением каждого дня.
function dayName(key) {
  if (key === dateKey(TODAY)) return t("calendar.today");
  if (key === dateKey(addDays(TODAY, -1))) return t("notifications.yesterday");
  const [year, month, day] = key.split("-").map(Number);
  return dayTitle(new Date(year, month - 1, day));
}

function revealMessage(node) {
  const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  node.scrollIntoView({block:'center',behavior:reducedMotion?'instant':'smooth'});
  if(document.activeElement?.matches(':focus-visible'))node.focus({preventScroll:true});
  const bubble=node.querySelector(`.${styles.bubbleMine}, .${styles.bubbleOther}`);
  if(!bubble)return;
  bubble.getAnimations().forEach(animation=>animation.cancel());
  const background=getComputedStyle(bubble).backgroundColor;
  bubble.animate([
    {backgroundColor:'color-mix(in srgb, var(--primary) 25%, var(--card))',boxShadow:'0 0 0 4px rgb(102 122 85 / 10%)',offset:0},
    {backgroundColor:'color-mix(in srgb, var(--primary) 25%, var(--card))',boxShadow:'0 0 0 4px rgb(102 122 85 / 10%)',offset:.35},
    {backgroundColor:background,boxShadow:'0 0 0 0 transparent',offset:1}
  ],{duration:reducedMotion?1200:1800,easing:'ease-out'});
}

function Chat() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { members, currentUserId, messages, sendMessage, sendRichMessage, deleteChatMessage, sendTyping, typingByChat, chatServerId, openChat, closeChat, loadHistoryUntil, markMessagesSeen } = useData();
  const screenRef = useRef(null);
  const submitBusy = useRef(false);
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);
  const typingClock = useRef(0);
  const typingTimer = useRef(null);
  useEffect(()=>{
    const stop=()=>{clearTimeout(typingTimer.current);typingClock.current=0;sendTyping(id,false);};
    const visibility=()=>{if(document.hidden)stop();};
    document.addEventListener('visibilitychange',visibility);
    window.addEventListener('blur',stop);
    return()=>{stop();document.removeEventListener('visibilitychange',visibility);window.removeEventListener('blur',stop);};
  },[id,sendTyping]);
  function reportTyping(value) {
    clearTimeout(typingTimer.current);
    if(!value.trim()){typingClock.current=0;sendTyping(id,false);return;}
    if(Date.now()-typingClock.current>2000){sendTyping(id,true);typingClock.current=Date.now();}
    typingTimer.current=setTimeout(()=>{typingClock.current=0;sendTyping(id,false);},3000);
  }
  const [recording,setRecording]=useState(false);
  const [text, setText] = useState("");
  const endRef = useRef(null);
  const messagesRef = useRef(null);
  const followLatest = useRef(true);
  const restoredEntry = useRef(null);
  useChatViewport(screenRef, messagesRef, followLatest);
  const jumpRef = useRef(null);
  const [reply,setReply]=useState(null);
  const [selection,setSelection]=useState(null);
  const [deleteTarget,setDeleteTarget]=useState(null);
  const [share,setShare]=useState(null);
  const [viewer,setViewer]=useState(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const draft=useAttachmentDraft(setError);
  const [menu,setMenu]=useState(null);
  const touch=useRef({timer:null});
  useEffect(()=>()=>clearTimeout(touch.current.timer),[]);

  const isGroup = id === GROUP_CHAT_ID;
  const partner = isGroup ? null : members.find((m) => m.id === id);
  const list = messages[id] ?? [];
  const gallery=list.flatMap(message=>message.deleted?[]:message.details?.mediaItems?.length?message.details.mediaItems:message.details?.media?[message.details.media]:[])
    .filter(media=>media.kind!=='round'&&(media.mime.startsWith('image/')||media.mime.startsWith('video/')));
  const viewedMedia=viewer?gallery.find(media=>media.id===viewer.id):null;
  const selecting=selection?.chatKey===id;
  const selectedMessages=selecting?list.filter(m=>selection.ids.includes(m.id)&&!m.deleted&&!m.pending):[];
  const selectedIds=new Set(selectedMessages.map(m=>m.id));
  const canDeleteSelected=selectedMessages.length>0&&selectedMessages.every(m=>m.from===currentUserId);
  useEffect(()=>{
    if(!selecting||!canDeleteSelected||menu||share||deleteTarget||recording)return;
    const keydown=e=>{
      if(e.defaultPrevented||e.key!=='Delete'||e.repeat||e.isComposing||e.ctrlKey||e.altKey||e.metaKey||e.shiftKey)return;
      if(e.target instanceof Element&&e.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]'))return;
      if(document.querySelector('dialog[open]'))return;
      e.preventDefault();setDeleteTarget({batch:true});
    };
    document.addEventListener('keydown',keydown);
    return()=>document.removeEventListener('keydown',keydown);
  },[selecting,canDeleteSelected,menu,share,deleteTarget,recording]);
  const activeReply = reply?.chatKey === id ? reply : null;
  const visibleCandidates=list.filter(m=>m.from!==currentUserId&&!m.deleted&&!m.pending).map(m=>m.id).join(',');
  useMessageViews({containerRef:messagesRef,chatKey:id,userId:currentUserId,messageIds:visibleCandidates,markMessagesSeen,blocked:!!menu||!!share||!!viewedMedia});

  // Пока экран открыт, новые сообщения сразу отмечаются прочитанными.
  useEffect(() => {
    openChat(id);
    return () => closeChat(id);
  }, [id, openChat, closeChat]);

  useLayoutEffect(() => {
    const entry = `${currentUserId}:${id}:${location.key}`;
    if(restoredEntry.current!==entry){
      restoredEntry.current=entry;
      const position=profileReturnPositions.get(entry);
      if(position!==undefined&&messagesRef.current){
        messagesRef.current.scrollTop=position;
        followLatest.current=false;
        return;
      }
    }
    if(jumpRef.current?.chatKey===id) {
      const node=document.getElementById(`chat-message-${jumpRef.current.messageId}`);
      if(node){revealMessage(node);jumpRef.current=null;}
      return;
    }
    if(followLatest.current && messagesRef.current)messagesRef.current.scrollTop=messagesRef.current.scrollHeight;
  }, [list.length,id,currentUserId,location.key]);

  if (!isGroup && (!partner || partner.id === currentUserId)) {
    return <Navigate to="/chats" replace />;
  }

  function handleBack(e) {
    if(selecting){e.preventDefault();setSelection(null);return;}
    if (location.key !== "default") {
      e.preventDefault();
      navigate(-1);
    }
  }
  function rememberChatPosition() {
    if(!messagesRef.current)return;
    profileReturnPositions.set(`${currentUserId}:${id}:${location.key}`,messagesRef.current.scrollTop);
    if(profileReturnPositions.size>50)profileReturnPositions.delete(profileReturnPositions.keys().next().value);
  }

  async function handleSend(e) {
    e.preventDefault(); const value=text.trim(); if((!value&&!draft.items.length)||busy||draft.preparing||submitBusy.current)return;
    submitBusy.current=true;
    reportTyping('');
    followLatest.current=true;
    setBusy(true);setError('');
    try {
      if(draft.items.length) await sendRichMessage(id,{text:value,replyId:activeReply?.id},draft.items.map(item=>item.file));
      else if(activeReply) await sendRichMessage(id,{text:value,replyId:activeReply.id});
      else await sendMessage(id,value);
      draft.clear();setText('');setReply(null);
    } catch(err){setError(errorText(err));}finally{submitBusy.current=false;setBusy(false);}
  }
  async function jumpToMessage(messageId) {
    followLatest.current=false;
    const node=document.getElementById(`chat-message-${messageId}`);
    if(node){revealMessage(node);return;}
    const request={chatKey:id,messageId};jumpRef.current=request;setError('');
    try {
      const found=await loadHistoryUntil(id,messageId);
      if(!found&&jumpRef.current===request){jumpRef.current=null;setError(t('chatRich.unavailable'));}
    } catch(err) {
      if(jumpRef.current===request){jumpRef.current=null;setError(errorText(err));}
    }
  }
  async function upload(event) {
    const files=Array.from(event.target.files??[]);event.target.value='';
    return uploadFiles(files);
  }
  async function uploadFiles(files) {
    if(busy||recording)return;
    return draft.add(files);
  }
  async function sendRecording(file,kind,duration) {
    setBusy(true);followLatest.current=true;
    try {await sendRichMessage(id,{kind,duration},file);} finally {setBusy(false);}
  }
  async function removeMessage(message, scope) {
    if(message.from!==currentUserId)return;
    closeMenu();setError('');
    await deleteChatMessage(id,message.id,scope);
    setDeleteTarget(null);
    if(reply?.id===message.id)setReply(null);
  }
  function toggleSelection(message) {
    if(message.deleted||message.pending||String(message.id).startsWith('tmp-'))return;
    setSelection(current=>{
      const ids=current?.chatKey===id?current.ids:[];
      return {chatKey:id,ids:ids.includes(message.id)?ids.filter(value=>value!==message.id):[...ids,message.id]};
    });
  }
  async function removeSelected(scope) {
    if(!canDeleteSelected)return;
    for(const message of selectedMessages){
      await deleteChatMessage(id,message.id,scope);
      setSelection(current=>current?{...current,ids:current.ids.filter(value=>value!==message.id)}:current);
      if(reply?.id===message.id)setReply(null);
    }
    setDeleteTarget(null);setSelection(null);
  }
  function openMenu(e,m) {
    if(m.deleted||m.pending||String(m.id).startsWith('tmp-'))return;
    e.preventDefault();if(selecting)return;const rect=e.currentTarget.getBoundingClientRect();
    setMenu({message:m,x:e.clientX||rect.left+20,y:e.clientY||rect.top+20});
  }
  function closeMenu() {
    clearTimeout(touch.current.timer);
    touch.current.suppress=false;
    setMenu(null);
  }
  function messageEvents(m) {return {
    id:`chat-message-${m.id}`,
    tabIndex:0,role:selecting?'checkbox':'group','aria-checked':selecting?selectedIds.has(m.id):undefined,'aria-label':t('chatRich.messageActions'),
    onContextMenu:e=>openMenu(e,m),
    onKeyDown:e=>{if(selecting&&(e.key===' '||e.key==='Enter')){e.preventDefault();toggleSelection(m);return;}if(e.key==='ContextMenu'||(e.shiftKey&&e.key==='F10'))openMenu(e,m);},
    onPointerDown:e=>{if(selecting||e.pointerType!=='touch')return;clearTimeout(touch.current.timer);const x=e.clientX,y=e.clientY;touch.current={x,y,timer:setTimeout(()=>{touch.current.suppress=true;if(!m.deleted&&!m.pending)setMenu({message:m,x,y});},500)};},
    onPointerMove:e=>{if(Math.abs(e.clientX-(touch.current.x??e.clientX))>10||Math.abs(e.clientY-(touch.current.y??e.clientY))>10)clearTimeout(touch.current.timer);},
    onPointerUp:()=>clearTimeout(touch.current.timer),onPointerCancel:()=>clearTimeout(touch.current.timer),
    onClickCapture:e=>{if(selecting){e.preventDefault();e.stopPropagation();toggleSelection(m);return;}if(touch.current.suppress){e.preventDefault();e.stopPropagation();touch.current.suppress=false;}}
  };}


  const typingNames = (typingByChat[id]?.userIds??[]).filter(userId=>userId!==currentUserId).map(userId=>members.find(member=>member.id===userId)?.name).filter(Boolean);
  const namesFormatter = new Intl.ListFormat(document.documentElement.lang || 'ru', {style:'long',type:'conjunction'});
  const typingLabel = typingNames.length>3
    ? t('chatRich.typingMore',{names:namesFormatter.format(typingNames.slice(0,2)),count:typingNames.length-2})
    : t(typingNames.length===1?'chatRich.typingOne':'chatRich.typingMany',{names:namesFormatter.format(typingNames)});
  const title = isGroup ? t("chats.family") : partner.name;
  const subtitle = isGroup
    ? t("plural.members", { count: members.length })
    : roleLabels[partner.role];
  const headerTo = isGroup ? `/chats/${id}/info` : `/more/family/${partner.id}`;

  return (
    <div id="chat-recording-stage" ref={screenRef} className={styles.screen}
      onDragEnter={e=>{if(!Array.from(e.dataTransfer.types).includes('Files'))return;e.preventDefault();dragDepth.current++;if(!busy&&!recording&&!draft.preparing)setDragging(true);}}
      onDragOver={e=>{if(Array.from(e.dataTransfer.types).includes('Files')){e.preventDefault();e.dataTransfer.dropEffect=busy||recording||draft.preparing?'none':'copy';}}}
      onDragLeave={e=>{e.preventDefault();dragDepth.current=Math.max(0,dragDepth.current-1);if(!dragDepth.current)setDragging(false);}}
      onDrop={e=>{if(!Array.from(e.dataTransfer.types).includes('Files'))return;e.preventDefault();dragDepth.current=0;setDragging(false);void uploadFiles(Array.from(e.dataTransfer.files));}}
      onKeyDown={e=>{if(e.key==='Escape'&&selecting&&!share&&!deleteTarget){e.preventDefault();setSelection(null);}}}>
      {dragging&&<div className={styles.dropOverlay} role="status"><Icon name="paperclip" size={32}/><strong>{t('chatRich.dropMedia')}</strong><span>{t('chatRich.limit')}</span></div>}
      <header className={styles.header}>
        <Link to="/chats" onClick={handleBack} className={styles.back} aria-label={t("common.back")}>
          <Icon name="back" />
        </Link>
        <Link to={headerTo} onClick={rememberChatPosition} className={styles.headerLink} aria-label={t("chats.open", { name: title })}>
          {isGroup ? (
            <Avatar letter={title[0]} size={40} />
          ) : (
            <Avatar letter={partner.letter} tone={partner.tone} photo={partner.photo} size={40} />
          )}
          <div className={styles.headerText}>
            <h1 className={styles.title}>{title}</h1>
            <span className={styles.subtitle}>{subtitle}</span>
          </div>
        </Link>
      </header>

      {selecting&&<div className={styles.selectionBar} role="toolbar" aria-label={t('chatRich.select')}>
        <button type="button" onClick={()=>setSelection(null)} aria-label={t('common.cancel')}><Icon name="close" size={20}/></button>
        <strong>{t('chatRich.selectedCount',{count:selectedMessages.length})}</strong>
        <button type="button" aria-label={t('chatRich.forward')} disabled={!selectedMessages.length} onClick={()=>setShare(selectedMessages.map(m=>({sourceChatId:chatServerId(id),forwardId:m.id})))}><Icon name="forward" size={20}/><span>{t('chatRich.forward')}</span></button>
        {canDeleteSelected&&<button type="button" aria-label={t('common.delete')} onClick={()=>setDeleteTarget({batch:true})}><Icon name="trash" size={20}/><span>{t('common.delete')}</span></button>}
      </div>}
      <div ref={messagesRef} className={styles.messages} onScroll={e=>{const node=e.currentTarget;followLatest.current=node.scrollHeight-node.scrollTop-node.clientHeight<60;}}>
        {list.every(m=>m.deleted) && <p className={styles.empty}>{t("chats.empty")}</p>}

        {list.map((m, i) => {
          const dayLabel =
            !m.deleted && (i === 0 || list.slice(0,i).filter(item=>!item.deleted).at(-1)?.day !== m.day) ? <div className={styles.day}>{dayName(m.day)}</div> : null;
          const text = <MessageContent message={m} chatId={chatServerId(id)} onJumpToMessage={jumpToMessage} onOpenMedia={(media,url)=>setViewer({id:media.id,initial:{id:media.id,url}})} />;
          if (m.from === currentUserId) {
            return (
              <MessagePresence key={m.id} deleted={m.deleted}>
                {dayLabel}
                <div className={`${styles.mine} ${selecting?styles.selectable:''} ${selectedIds.has(m.id)?styles.selected:''}`} {...messageEvents(m)}>
                  <div className={`${styles.bubbleMine} ${m.details?.media?.kind==='round'?styles.roundBubble:(m.details?.media||m.details?.mediaItems?.length)?styles.mediaBubble:''}`}>{text}</div>
                  <span className={styles.meta}>
                    {m.time}
                    {m.statusKey&&<span className={styles.delivery}>
                      {!m.pending&&!m.failed&&<Icon name={m.readByAll?'checks':'check'} size={15}/>}
                      {t(m.statusKey)}
                    </span>}
                  </span>
                </div>
              </MessagePresence>
            );
          }
          const author = members.find((member) => member.id === m.from);
          return (
            <MessagePresence key={m.id} deleted={m.deleted}>
              {dayLabel}
              <div className={styles.other}>
                {author?<Link to={`/more/family/${author.id}`} onClick={rememberChatPosition} className={styles.senderAvatar} aria-label={author.name}>
                  <Avatar letter={author?.letter ?? "?"} tone={author?.tone ?? "cream"} photo={author?.photo} size={32} />
                </Link>:<span className={styles.senderAvatar} role="img" aria-label={t("common.formerMember")}><Avatar letter="?" tone="cream" size={32}/></span>}
                <div className={`${styles.otherBody} ${selecting?styles.selectable:''} ${selectedIds.has(m.id)?styles.selected:''}`} {...messageEvents(m)} data-view-message={m.deleted?undefined:m.id}>
                  <div className={`${styles.bubbleOther} ${m.details?.media?.kind==='round'?styles.roundBubble:(m.details?.media||m.details?.mediaItems?.length)?styles.mediaBubble:''}`}>
                    {isGroup && <b className={styles.author}>{author?.name ?? t("common.formerMember")}</b>}
                    {text}
                  </div>
                  <span className={styles.meta}>{m.time}</span>
                </div>
              </div>
            </MessagePresence>
          );
        })}

        <div ref={endRef} />
      </div>

      {menu&&<MessageMenu onSelect={()=>{setReply(null);setSelection({chatKey:id,ids:[menu.message.id]});closeMenu();}} onDelete={menu.message.from===currentUserId?()=>{setDeleteTarget(menu.message);closeMenu();}:undefined} x={menu.x} y={menu.y} onClose={closeMenu} onReply={()=>{setReply({...menu.message,chatKey:id});closeMenu();document.getElementById('message')?.focus();}} onForward={()=>{setShare({sourceChatId:chatServerId(id),forwardId:menu.message.id});closeMenu();}}/>}
      {deleteTarget&&(deleteTarget.batch?canDeleteSelected:deleteTarget.from===currentUserId)&&<DeleteMessageDialog title={deleteTarget.batch?t('chatRich.deleteSelectedTitle',{count:selectedMessages.length}):undefined} canDeleteAll onClose={()=>setDeleteTarget(null)} onDelete={scope=>deleteTarget.batch?removeSelected(scope):removeMessage(deleteTarget,scope)}/>}
      {viewedMedia&&<MediaViewer media={viewedMedia} items={gallery} chatId={chatServerId(id)} initialResource={viewer.initial} onChange={mediaId=>setViewer(current=>({...current,id:mediaId}))} onClose={()=>setViewer(null)}/>}
      {share&&<ChatShare payload={share} onSent={()=>setSelection(null)} onClose={()=>setShare(null)}/>}
      <div className={styles.typing} role="status" aria-live="polite" aria-atomic="true">{typingNames.length>0&&typingLabel}</div>
      {error&&<p className={styles.feedback} role="alert">{error}</p>}
      {busy&&<p className={styles.feedback} role="status">{t('chatRich.sending')}</p>}
      {activeReply&&<div className={styles.reply}><Icon name="reply" size={20}/><div><b>{t('chatRich.replying')}</b><span>{activeReply.text.slice(0,120)}</span></div><button type="button" onClick={()=>setReply(null)} aria-label={t('chatRich.cancelReply')}><Icon name="close" size={20}/></button></div>}
      <AttachmentDraft items={draft.items} disabled={busy||draft.preparing} onRemove={draft.remove} onClear={draft.clear}/>
      {draft.preparing&&<p className={styles.feedback} role="status">{t('chatRich.preparingMedia')}</p>}
      <form className={`${styles.form} ${recording?styles.recordingForm:''}`} onSubmit={handleSend}>
        <Attachments disabled={busy||recording||draft.preparing} onUpload={upload}/>
        <label htmlFor="message" className={styles.srOnly}>
          {t("chats.message")}
        </label>
        <input
          id="message"
          type="text"
          placeholder={t(draft.items.length?"chatRich.caption":"chats.placeholder")}
          className={styles.input}
          maxLength={2000}
          disabled={busy||recording}
          value={text}
          onBlur={()=>reportTyping('')}
          onChange={(e) => {setText(e.target.value);reportTyping(e.target.value);}}
        />
        {text.trim()||draft.items.length?<button type="submit" disabled={busy||draft.preparing} className={styles.send} aria-label={t("chats.send")}>
          <Icon name="send" size={20} />
        </button>:<Recorder key={id} disabled={busy||draft.preparing} onSend={sendRecording} onRecordingChange={setRecording}/>}
      </form>
    </div>
  );
}

export default function ChatRoute() {
  const {id}=useParams();
  return <Chat key={id}/>;
}
