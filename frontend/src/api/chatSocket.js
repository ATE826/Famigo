import { api } from "./client";

// WebSocket чата. Как подключаемся:
//  1. обычным защищённым запросом берём одноразовый «билет» (живёт 30 секунд);
//  2. открываем ws://<этот же адрес>/api/chats/ws?ticket=...
// Токен в адрес не кладём: адреса попадают в логи и историю.
//
// Если связь оборвалась (сон ноутбука, смена сети), переподключаемся с растущей паузой:
// 1, 2, 4… но не дольше 30 секунд. После переподключения onOpen даёт знать,
// что нужно догрузить пропущенные сообщения.

const MAX_DELAY = 30_000;

export function connectChatSocket({ onEvent, onOpen, onClose }) {
  let socket = null;
  let stopped = false;
  let delay = 1000;
  let timer = null;

  async function connect() {
    if (stopped) return;
    try {
      const { ticket } = await api("/chats/ws-ticket", { method: "POST" });
      if (stopped) return;
      const protocol = window.location.protocol === "https:" ? "wss" : "ws";
      socket = new WebSocket(`${protocol}://${window.location.host}/api/chats/ws?ticket=${encodeURIComponent(ticket)}`);
    } catch {
      retry();
      return;
    }

    socket.onopen = () => {
      delay = 1000;
      onOpen?.();
    };
    socket.onmessage = (message) => {
      try {
        onEvent(JSON.parse(message.data));
      } catch {
        // сервер прислал не JSON — игнорируем
      }
    };
    socket.onclose = () => {
      socket = null;
      onClose?.();
      retry();
    };
  }

  function retry() {
    if (stopped) return;
    clearTimeout(timer);
    timer = setTimeout(connect, delay);
    delay = Math.min(delay * 2, MAX_DELAY);
  }

  connect();

  return {
    // send возвращает false, если соединения сейчас нет — тогда отправим обычным запросом.
    send(data) {
      if (socket?.readyState !== WebSocket.OPEN) return false;
      socket.send(JSON.stringify(data));
      return true;
    },
    close() {
      stopped = true;
      clearTimeout(timer);
      socket?.close();
    },
  };
}
