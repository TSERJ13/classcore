const studentsList = [{id: 's1', phone: '514199966', full_name: 'TEST'}];
const allSubs = [{id: 'sub1', student_id:'s1', status: 'active', expires_at: new Date().toISOString().split('T')[0], plan: 'Demo', total_visits: 12, used_visits: 12}];

const todayDateStr = new Date().toISOString().split('T')[0];

Object.values(allSubs).flat().forEach(sub => {
    const isExpiringToday = sub.expires_at === todayDateStr;
    const isOutOfVisits = sub.total_visits > 0 && (sub.total_visits - (sub.used_visits || 0)) <= 0;
    
    console.log({isExpiringToday, isOutOfVisits, active: sub.status === 'active'});
});
