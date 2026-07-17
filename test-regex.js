function parseWhatsAppDate(dateStr) {
    let cleanStr = dateStr.replace(/^\[/, '').replace(/\]$/, '').trim();
    const regexDate = /^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})[, ]+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*([aApP])\.?\s*[mM]\.?)?/;
    const match = cleanStr.match(regexDate);
    if (match) {
        let [_, p1, p2, yearStr, hStr, mStr, sStr, ampm] = match;
        let day = parseInt(p1);
        let month = parseInt(p2);
        let year = parseInt(yearStr);
        if (year < 100) year += 2000;
        
        if (month > 12 && day <= 12) {
            let temp = day;
            day = month;
            month = temp;
        }

        let hour = parseInt(hStr);
        let min = parseInt(mStr);
        let sec = sStr ? parseInt(sStr) : 0;
        
        if (ampm) {
            let isPm = ampm.toLowerCase() === 'p';
            if (isPm && hour < 12) hour += 12;
            if (!isPm && hour === 12) hour = 0;
        }

        return new Date(year, month - 1, day, hour, min, sec);
    }
    return new Date(cleanStr);
}

console.log(parseWhatsAppDate("23/1/24 10:25:34"));
console.log(parseWhatsAppDate("1/23/24, 10:25 AM"));
console.log(parseWhatsAppDate("15/5/2023 3:30 p. m."));
console.log(parseWhatsAppDate("15/5/23, 3:30 p.m."));
console.log(parseWhatsAppDate("24/8/23, 10:14:15 a. m."));

