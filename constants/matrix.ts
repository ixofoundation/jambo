const cons = {
  version: '0.0.1',
  secretKey: {
    ACCESS_TOKEN: 'mx_ixo_access_token',
    DEVICE_ID: 'mx_ixo_device_id',
    USER_ID: 'mx_ixo_user_id',
    BASE_URL: 'mx_ixo_hs_base_url',
  },
  DEVICE_DISPLAY_NAME: 'JAMBO CLAIMS',
  IN_IXO_SPACES: 'in.ixo.spaces',
  // types that will get notifs and can see
  supportEventTypes: ['m.room.create', 'm.room.message', 'm.room.encrypted', 'm.room.member', 'm.sticker'],
  supportReceiptTypes: ['m.read', 'm.read.private'],
  notifs: {
    DEFAULT: 'default',
    ALL_MESSAGES: 'all_messages',
    MENTIONS_AND_KEYWORDS: 'mentions_and_keywords',
    MUTE: 'mute',
  },
  status: {
    PRE_FLIGHT: 'pre-flight',
    IN_FLIGHT: 'in-flight',
    SUCCESS: 'success',
    ERROR: 'error',
  },
  actions: {
    room: {
      JOIN: 'JOIN',
      LEAVE: 'LEAVE',
      CREATE: 'CREATE',
    },
    accountData: {
      CREATE_SPACE_SHORTCUT: 'CREATE_SPACE_SHORTCUT',
      DELETE_SPACE_SHORTCUT: 'DELETE_SPACE_SHORTCUT',
      MOVE_SPACE_SHORTCUTS: 'MOVE_SPACE_SHORTCUTS',
      CATEGORIZE_SPACE: 'CATEGORIZE_SPACE',
      UNCATEGORIZE_SPACE: 'UNCATEGORIZE_SPACE',
    },
    settings: {
      TOGGLE_NOTIFICATIONS: 'TOGGLE_NOTIFICATIONS',
      TOGGLE_NOTIFICATION_SOUNDS: 'TOGGLE_NOTIFICATION_SOUNDS',
    },
  },
  events: {
    roomList: {
      ROOMLIST_UPDATED: 'ROOMLIST_UPDATED',
      INVITELIST_UPDATED: 'INVITELIST_UPDATED',
      ROOM_JOINED: 'ROOM_JOINED',
      ROOM_LEAVED: 'ROOM_LEAVED',
      ROOM_CREATED: 'ROOM_CREATED',
      ROOM_PROFILE_UPDATED: 'ROOM_PROFILE_UPDATED',
    },
    accountData: {
      SPACE_SHORTCUT_UPDATED: 'SPACE_SHORTCUT_UPDATED',
      CATEGORIZE_SPACE_UPDATED: 'CATEGORIZE_SPACE_UPDATED',
    },
    roomTimeline: {
      READY: 'READY',
      EVENT: 'EVENT',
      PAGINATED: 'PAGINATED',
      TYPING_MEMBERS_UPDATED: 'TYPING_MEMBERS_UPDATED',
      LIVE_RECEIPT: 'LIVE_RECEIPT',
      EVENT_REDACTED: 'EVENT_REDACTED',
      AT_BOTTOM: 'AT_BOTTOM',
      SCROLL_TO_LIVE: 'SCROLL_TO_LIVE',
    },
    settings: {
      NOTIFICATIONS_TOGGLED: 'NOTIFICATIONS_TOGGLED',
      NOTIFICATION_SOUNDS_TOGGLED: 'NOTIFICATION_SOUNDS_TOGGLED',
    },
  },
};

Object.freeze(cons);

export default cons;
