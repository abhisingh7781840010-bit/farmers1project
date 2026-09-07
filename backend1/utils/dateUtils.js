/**
 * Date and time helper utilities for procurement center schedules and ML features
 */

/**
 * Parses "HH:MM" (24-hour format) into minutes from midnight
 * @param {string} timeStr - e.g. "09:30"
 * @returns {number}
 */
const timeToMinutes = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return (hours * 60) + (minutes || 0);
};

/**
 * Checks if the given current time is within open and close hours
 * @param {string} openTime - e.g. "09:00"
 * @param {string} closeTime - e.g. "17:00"
 * @param {Date} [currentDate=new Date()]
 * @returns {boolean}
 */
const isTimeWithinOperatingHours = (openTime, closeTime, currentDate = new Date()) => {
  if (!openTime || !closeTime) return true;

  const currentMinutes = (currentDate.getHours() * 60) + currentDate.getMinutes();
  const openMinutes = timeToMinutes(openTime);
  const closeMinutes = timeToMinutes(closeTime);

  return currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
};

/**
 * Get current hour (0-23) and day of week (0-6)
 */
const getCurrentTemporalFeatures = () => {
  const now = new Date();
  return {
    hour: now.getHours(),
    dayOfWeek: now.getDay()
  };
};

module.exports = {
  timeToMinutes,
  isTimeWithinOperatingHours,
  getCurrentTemporalFeatures
};
