/**
 * Date Utilities
 * Provides common date formatting functions.
 */
class DateUtils {
    /**
     * Formats a date string into a relative time format (e.g., "2 hours ago").
     * @param {string|Date} dateString - The date to format.
     * @returns {string} - The relative time string.
     */
    static formatRelative(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        const now = new Date();
        const seconds = Math.round((now - date) / 1000);

        const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

        if (seconds < 60) return rtf.format(-seconds, 'second');
        const minutes = Math.round(seconds / 60);
        if (minutes < 60) return rtf.format(-minutes, 'minute');
        const hours = Math.round(minutes / 60);
        if (hours < 24) return rtf.format(-hours, 'hour');
        const days = Math.round(hours / 24);
        if (days < 7) return rtf.format(-days, 'day');
        
        // For older dates, show the actual date
        return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(date);
    }

    /**
     * Formats a date string with the time (e.g., "Dec 25, 2024, 5:30 PM").
     * @param {string|Date} dateString - The date to format.
     * @returns {string} - The formatted date and time string.
     */
    static formatWithTime(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('en', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        }).format(date);
    }

    /**
     * Formats a date for an input field (YYYY-MM-DDTHH:mm).
     * @param {string|Date} dateString - The date to format.
     * @returns {string} - The formatted string for datetime-local input.
     */
    static formatForInput(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        // Adjust for timezone offset to display correctly in local time
        const tzoffset = (new Date()).getTimezoneOffset() * 60000;
        const localISOTime = (new Date(date - tzoffset)).toISOString().slice(0, 16);
        return localISOTime;
    }
}

export default DateUtils;