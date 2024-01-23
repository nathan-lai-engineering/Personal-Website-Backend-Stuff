module.exports = {
    /**
     * Get a human readable time at the current time
     * @returns 
     */
    humanTimeNow(){
        let date = new Date();
        const format = {
            dd: formatData(date.getDate()),
            mm: formatData(date.getMonth() + 1),
            yyyy: date.getFullYear(),
            HH: formatData(date.getHours()),
            hh: formatData(formatHour(date.getHours())),
            MM: formatData(date.getMinutes()),
            SS: formatData(date.getSeconds()),
        };
        const format24Hour = ({ dd, mm, yyyy, HH, MM, SS }) => {
            return `${HH}:${MM}:${SS} ${mm}/${dd}/${yyyy}`;
        };
        return format24Hour(format);
    }
}

function formatData(input){
    if (input > 9) {
      return input;
    } else return `0${input}`;
};

function formatHour(input){
if (input > 12) {
    return input - 12;
}
return input;
};