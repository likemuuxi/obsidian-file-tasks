import { moment } from 'obsidian';

export class DateUtils {
    // Regex for parsing dates with icons
    // Captures: Group 1 = Icon, Group 2 = Date String (YYYY-MM-DD [HH:mm])
    // Note: Use 'g' flag if iterating, but be careful with shared instances.
    // Better to use a getter or re-instantiate if 'g' is used across different contexts.
    static readonly DATE_REGEX_SOURCE = '([📅⏳🛫✅❌➕])\\s(\\d{4}-\\d{2}-\\d{2}(?:\\s\\d{2}:\\d{2})?)';

    // Returns a new RegExp instance to avoid state issues with /g flag
    static getDateRegex(): RegExp {
        return new RegExp(this.DATE_REGEX_SOURCE, 'gu');
    }

    static formatRelativeDate(dateStr: string): string {
        // Parse date string which might include time
        // Format could be YYYY-MM-DD or YYYY-MM-DD HH:mm
        const date = moment(dateStr, ['YYYY-MM-DD HH:mm', 'YYYY-MM-DD']);
        if (!date.isValid()) return dateStr;

        const now = moment();

        // Helper to check if time is included in the string
        const hasTime = /\d{2}:\d{2}/.test(dateStr);
        const timeStr = hasTime ? date.format('HH:mm') : '';

        const diffMinutes = now.diff(date, 'minutes');
        const absDiffMinutes = Math.abs(diffMinutes);

        // 1. Minute Level (within 60 mins)
        if (absDiffMinutes < 60) {
            if (absDiffMinutes < 1) return '刚刚';
            if (diffMinutes > 0) return `${absDiffMinutes}分钟前`;
            return `${absDiffMinutes}分钟后`;
        }

        // 2. Hour Level (within 24 hours)
        if (absDiffMinutes < 24 * 60) {
            const hours = Math.floor(absDiffMinutes / 60);
            if (diffMinutes > 0) return `${hours}小时前`;
            return `${hours}小时后`;
        }

        const isToday = date.isSame(now, 'day');
        const isYesterday = date.clone().add(1, 'days').isSame(now, 'day');
        const isTomorrow = date.clone().subtract(1, 'days').isSame(now, 'day');
        const isDayAfterTomorrow = date.clone().subtract(2, 'days').isSame(now, 'day'); // 后天
        const isThisYear = date.isSame(now, 'year');

        if (isToday) {
            if (hasTime) return timeStr;
            return '今天';
        }

        if (isYesterday) {
            return '昨天 ' + timeStr;
        }

        if (isTomorrow) {
            return '明天 ' + timeStr;
        }

        if (isDayAfterTomorrow) {
            return '后天 ' + timeStr;
        }

        // 7 Days or This Year -> M月D日
        if (isThisYear) {
            let res = date.format('M月D日');
            if (hasTime) res += ' ' + timeStr;
            return res;
        }

        // Other -> YYYY年M月D日
        let res = date.format('YYYY年M月D日');
        if (hasTime) res += ' ' + timeStr;
        return res;
    }
}
