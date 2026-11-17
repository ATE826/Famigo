import MessageMenu from "../../components/ChatShare/MessageMenu";
import Attachments from "../../components/ChatShare/Attachments";
import {prepareMedia} from "../../utils/media";
import ChatShare from "../../components/ChatShare/ChatShare";
import MessageContent from "../../components/ChatShare/MessageContent";
import {errorText} from "../../api/client";
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
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
  const { members, currentUserId, messages, sendMessage, sendRichMessage, chatServerId, openChat, closeChat, loadHistoryUntil, markMessagesSeen } = useData();
  const [text, setText] = useState("");
  const endRef = useRef(null);
  const messagesRef = useRef(null);
  const followLatest = useRef(true);
  const restoredEntry = useRef(null);
  const jumpRef = useRef(null);
  const [reply,setReply]=useState(null);
  const [share,setShare]=useState(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [menu,setMenu]=useState(null);
  const touch=useRef({timer:null});
  useEffect(()=>()=>clearTimeout(touch.current.timer),[]);

  const isGroup = id === GROUP_CHAT_ID;
  const partner = isGroup ? null : members.find((m) => m.id === id);
  const list = messages[id] ?? [];
  const activeReply = reply?.chatKey === id ? reply : null;
  const visibleCandidates=list.filter(m=>m.from!==currentUserId&&!m.deleted&&!m.pending).map(m=>m.id).join(',');
  useMessageViews({containerRef:messagesRef,chatKey:id,userId:currentUserId,messageIds:visibleCandidates,markMessagesSeen,blocked:!!menu||!!share});

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
    if(followLatest.current)endRef.current?.scrollIntoView({ block: "end" });
  }, [list.length,id,currentUserId,location.key]);

  if (!isGroup && (!partner || partner.id === currentUserId)) {
    return <Navigate to="/chats" replace />;
  }

  function handleBack(e) {
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
    e.preventDefault(); const value=text.trim(); if(!value||busy)return;
    setBusy(true);setError('');
    try { if(activeReply) await sendRichMessage(id,{text:value,replyId:activeReply.id}); else await sendMessage(id,value); setText('');setReply(null); }
    catch(err){setError(errorText(err));}finally{setBusy(false);}
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
    const files=Array.from(event.target.files??[]);event.target.value='';if(!files.length)return;
    if(files.some(file=>file.size>25*1024*1024)){setError(t('chatRich.tooLarge'));return;}
    setBusy(true);setError('');try{for(const file of files){const prepared=await prepareMedia(file);if(!prepared)throw new Error(t('chatRich.chooseMedia'));await sendRichMessage(id,{},prepared.file);}}catch(err){setError(errorText(err));}finally{setBusy(false);}
  }
  function openMenu(e,m) {
    if(m.deleted||m.pending||String(m.id).startsWith('tmp-'))return;
    e.preventDefault();const rect=e.currentTarget.getBoundingClientRect();
    setMenu({message:m,x:e.clientX||rect.left+20,y:e.clientY||rect.top+20});
  }
  function closeMenu() {
    clearTimeout(touch.current.timer);
    touch.current.suppress=false;
    setMenu(null);
  }
  function messageEvents(m) {return {
    id:`chat-message-${m.id}`,
    tabIndex:0,role:'group','aria-label':t('chatRich.messageActions'),
    onContextMenu:e=>openMenu(e,m),
    onKeyDown:e=>{if(e.key==='ContextMenu'||(e.shiftKey&&e.key==='F10'))openMenu(e,m);},
    onPointerDown:e=>{if(e.pointerType!=='touch')return;clearTimeout(touch.current.timer);const x=e.clientX,y=e.clientY;touch.current={x,y,timer:setTimeout(()=>{touch.current.suppress=true;if(!m.deleted&&!m.pending)setMenu({message:m,x,y});},500)};},
    onPointerMove:e=>{if(Math.abs(e.clientX-(touch.current.x??e.clientX))>10||Math.abs(e.clientY-(touch.current.y??e.clientY))>10)clearTimeout(touch.current.timer);},
    onPointerUp:()=>clearTimeout(touch.current.timer),onPointerCancel:()=>clearTimeout(touch.current.timer),
    onClickCapture:e=>{if(touch.current.suppress){e.preventDefault();e.stopPropagation();touch.current.suppress=false;}}
  };}


  const title = isGroup ? t("chats.family") : partner.name;
  const subtitle = isGroup
    ? t("plural.members", { count: members.length })
    : roleLabels[partner.role];
  const headerTo = isGroup ? `/chats/${id}/info` : `/more/family/${partner.id}`;

  return (
    <div className={styles.screen}>
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

      <div ref={messagesRef} className={styles.messages} onScroll={e=>{const node=e.currentTarget;followLatest.current=node.scrollHeight-node.scrollTop-node.clientHeight<60;}}>
        {list.length === 0 && <p className={styles.empty}>{t("chats.empty")}</p>}

        {list.map((m, i) => {
          const dayLabel =
            i === 0 || list[i - 1].day !== m.day ? <div className={styles.day}>{dayName(m.day)}</div> : null;
          const text = <MessageContent message={m} chatId={chatServerId(id)} onJumpToMessage={jumpToMessage} />;
          if (m.from === currentUserId) {
            return (
              <Fragment key={m.id}>
                {dayLabel}
                <div className={styles.mine} {...messageEvents(m)}>
                  <div className={styles.bubbleMine}>{text}</div>
                  <span className={styles.meta}>
                    {m.time}
                    {m.statusKey&&<span className={styles.delivery}>
                      {!m.pending&&!m.failed&&<Icon name={m.readByAll?'checks':'check'} size={15}/>}
                      {t(m.statusKey)}
                    </span>}
                  </span>
                </div>
              </Fragment>
            );
          }
          const author = members.find((member) => member.id === m.from);
          return (
            <Fragment key={m.id}>
              {dayLabel}
              <div className={styles.other}>
                {author?<Link to={`/more/family/${author.id}`} onClick={rememberChatPosition} className={styles.senderAvatar} aria-label={author.name}>
                  <Avatar letter={author?.letter ?? "?"} tone={author?.tone ?? "cream"} photo={author?.photo} size={32} />
                </Link>:<span className={styles.senderAvatar} role="img" aria-label={t("common.formerMember")}><Avatar letter="?" tone="cream" size={32}/></span>}
                <div className={styles.otherBody} {...messageEvents(m)} data-view-message={m.deleted?undefined:m.id}>
                  <div className={styles.bubbleOther}>
                    {isGroup && <b className={styles.author}>{author?.name ?? t("common.formerMember")}</b>}
                    {text}
                  </div>
                  <span className={styles.meta}>{m.time}</span>
                </div>
              </div>
            </Fragment>
          );
        })}

        <div ref={endRef} />
      </div>

      {menu&&<MessageMenu x={menu.x} y={menu.y} onClose={closeMenu} onReply={()=>{setReply({...menu.message,chatKey:id});closeMenu();document.getElementById('message')?.focus();}} onForward={()=>{setShare({sourceChatId:chatServerId(id),forwardId:menu.message.id});closeMenu();}}/>}
      {share&&<ChatShare payload={share} onClose={()=>setShare(null)}/>}
      {error&&<p className={styles.feedback} role="alert">{error}</p>}
      {busy&&<p className={styles.feedback} role="status">{t('chatRich.sending')}</p>}
      {activeReply&&<div className={styles.reply}><Icon name="reply" size={20}/><div><b>{t('chatRich.replying')}</b><span>{activeReply.text.slice(0,120)}</span></div><button type="button" onClick={()=>setReply(null)} aria-label={t('chatRich.cancelReply')}><Icon name="close" size={20}/></button></div>}
      <form className={styles.form} onSubmit={handleSend}>
        <Attachments disabled={busy} onUpload={upload}/>
        <label htmlFor="message" className={styles.srOnly}>
          {t("chats.message")}
        </label>
        <input
          id="message"
          type="text"
          placeholder={t("chats.placeholder")}
          className={styles.input}
          maxLength={2000}
          disabled={busy}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" disabled={busy||!text.trim()} className={styles.send} aria-label={t("chats.send")}>
          <Icon name="send" size={20} />
        </button>
      </form>
    </div>
  );
}

export default Chat;
