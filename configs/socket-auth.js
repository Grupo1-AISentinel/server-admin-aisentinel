'use strict';

import Coordinator from '../src/coordinator/coordinator.model.js';

const CACHE_TTL_MS = 5 * 60 * 1000;
const gradeCache = new Map();

export const ADMIN_ROLE = 'ADMIN_ROLE';
export const COORDINATOR_ROLE = 'COORDINATOR_ROLE';

export const resolveCoordinatorGrade = async (userId) => {
  if (!userId) return null;
  const cached = gradeCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.grade;

  const coord = await Coordinator.findOne({ authUserId: userId, isActive: true })
    .select('grade')
    .lean();
  const grade = coord?.grade ?? null;
  gradeCache.set(userId, { grade, expiresAt: Date.now() + CACHE_TTL_MS });
  return grade;
};

export const canCoordinatorSeeCamera = (coordGrade, cameraDoc) => {
  if (!coordGrade) return false;
  if (!cameraDoc?.grade) return false;
  return cameraDoc.grade === coordGrade;
};

export const clearGradeCache = (userId) => {
  if (userId) gradeCache.delete(userId);
  else gradeCache.clear();
};
