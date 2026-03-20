import { getStudioRegistry } from './settings-store';

export function getGlobalUnreadCount(): number {
    if (typeof window === 'undefined') return 0;
    
    const slugs = getStudioRegistry();
    let totalUnread = 0;

    slugs.forEach(slug => {
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key?.startsWith(`chat_${slug}_`) || key === `chat_${slug}_classcore_support`) {
                    const msgs = JSON.parse(localStorage.getItem(key) || '[]');
                    if (Array.isArray(msgs)) {
                        const hasUnread = msgs.some((m: any) => !m.read && m.sender !== 'student');
                        if (hasUnread) totalUnread++;
                    }
                }
            }
        } catch { }
    });

    return totalUnread;
}
