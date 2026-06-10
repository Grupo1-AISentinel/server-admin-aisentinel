'use strict';

import Notification from './notification.model.js';
import NotificationReadState from './notification-read-state.model.js';
import Coordinator from '../coordinator/coordinator.model.js';
import { io } from '../../configs/app.js';
import { resolveCoordinatorGrade } from '../../configs/socket-auth.js';

const RECENT_NOTIFICATION_THROTTLE_MS = 60_000;

const buildTargetRooms = (notif) => {
  const rooms = new Set();
  if (notif.targetUserId) rooms.add(`user:${notif.targetUserId}`);
  if (notif.targetRole) {
    rooms.add(`role:${notif.targetRole}`);
    if (notif.targetGrade) rooms.add(`grade:${notif.targetGrade}`);
  }
  return [...rooms];
};

const toDto = (notif) => ({
  _id: String(notif._id),
  type: notif.type,
  title: notif.title,
  message: notif.message,
  data: notif.data || {},
  createdAt: notif.createdAt,
});

export const createNotification = async ({ type, title, message, data, target }) => {
  if (!type || !title || !message) return null;
  const notif = await Notification.create({
    type,
    title,
    message,
    data: data || {},
    targetRole: target?.role || null,
    targetGrade: target?.grade || null,
    targetUserId: target?.userId || null,
  });
  if (io) {
    io.to(buildTargetRooms(notif)).emit('notification:new', toDto(notif));
  }
  return notif;
};

export const emitRecentThrottled = async ({
  type,
  title,
  message,
  data,
  target,
  throttleKey,
}) => {
  const since = new Date(Date.now() - RECENT_NOTIFICATION_THROTTLE_MS);
  const query = { type, createdAt: { $gte: since } };
  if (target?.role) query.targetRole = target.role;
  else query.targetRole = null;
  if (target?.grade) query.targetGrade = target.grade;
  else query.targetGrade = null;
  if (target?.userId) query.targetUserId = target.userId;
  else query.targetUserId = null;
  if (throttleKey && data) {
    const keyField = `data.${throttleKey}`;
    query[keyField] = data[throttleKey];
  }
  const recent = await Notification.findOne(query).lean();
  if (recent) return null;
  return createNotification({ type, title, message, data, target });
};

const userVisibleFilter = (userId, role, grade) => {
  const or = [
    { targetUserId: userId },
    { targetRole: role, targetGrade: null, targetUserId: null },
  ];
  if (grade) {
    or.push({ targetRole: role, targetGrade: grade, targetUserId: null });
  }
  if (role === 'ADMIN_ROLE') {
    or.push({ targetRole: 'ADMIN_ROLE' });
  }
  return { $or: or };
};

export const getMyNotifications = async (req, res) => {
  try {
    const userId = req.userId;
    const role = req.userRole;
    const grade = role === 'COORDINATOR_ROLE' ? await resolveCoordinatorGrade(userId) : null;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const filter = userVisibleFilter(userId, role, grade);
    const items = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return res.status(200).json({
      success: true,
      items: items.map((n) => ({
        _id: String(n._id),
        type: n.type,
        title: n.title,
        message: n.message,
        data: n.data || {},
        createdAt: n.createdAt,
      })),
    });
  } catch (err) {
    console.error('[notifications] getMyNotifications:', err);
    return res.status(500).json({ success: false, message: 'Error al obtener notificaciones' });
  }
};

export const getUnreadCount = async (req, res) => {
  try {
    const userId = req.userId;
    const role = req.userRole;
    const grade = role === 'COORDINATOR_ROLE' ? await resolveCoordinatorGrade(userId) : null;

    const state = await NotificationReadState.findOne({ userId }).lean();
    const lastReadAt = state?.lastReadAt || new Date(0);

    const filter = { ...userVisibleFilter(userId, role, grade), createdAt: { $gt: lastReadAt } };
    const count = await Notification.countDocuments(filter);
    return res.status(200).json({ success: true, count, lastReadAt });
  } catch (err) {
    console.error('[notifications] getUnreadCount:', err);
    return res.status(500).json({ success: false, message: 'Error al contar notificaciones' });
  }
};

export const markAllAsRead = async (req, res) => {
  try {
    const userId = req.userId;
    const now = new Date();
    await NotificationReadState.findOneAndUpdate(
      { userId },
      { $set: { lastReadAt: now, userId } },
      { upsert: true, new: true }
    );
    return res.status(200).json({ success: true, lastReadAt: now });
  } catch (err) {
    console.error('[notifications] markAllAsRead:', err);
    return res.status(500).json({ success: false, message: 'Error al marcar como leídas' });
  }
};
