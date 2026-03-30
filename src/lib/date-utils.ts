import { SearchSelectOption } from '@/components/ui/SearchSelect';

export const generateTimeOptions = (stepMinutes = 15): SearchSelectOption[] => {
    const options: SearchSelectOption[] = [];
    for (let h = 0; h < 24; h++) {
        for (let m = 0; m < 60; m += stepMinutes) {
            const time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
            options.push({ value: time, label: time });
        }
    }
    return options;
};

export const generateDayOptions = (): SearchSelectOption[] => {
    return Array.from({ length: 31 }, (_, i) => ({
        value: (i + 1).toString().padStart(2, '0'),
        label: (i + 1).toString()
    }));
};

export const generateMonthOptions = (lang: string): SearchSelectOption[] => {
    const monthsKA = [
        'იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი',
        'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი'
    ];
    const monthsRU = [
        'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
        'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
    ];
    const monthsEN = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const months = lang === 'ka' ? monthsKA : lang === 'ru' ? monthsRU : monthsEN;
    return months.map((m, i) => ({
        value: (i + 1).toString().padStart(2, '0'),
        label: m
    }));
};

export const generateYearOptions = (start = 1950, end = new Date().getFullYear()): SearchSelectOption[] => {
    const options: SearchSelectOption[] = [];
    for (let y = end; y >= start; y--) {
        options.push({ value: y.toString(), label: y.toString() });
    }
    return options;
};
