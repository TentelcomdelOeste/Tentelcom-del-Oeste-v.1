const iosRegex = /^\[(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}[, ]+\d{1,2}:\d{2}:\d{2}(?: [APap][Mm])?)\]\s+(.*?):\s+(.*)$/;
const androidRegex = /^(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}[, ]+\d{1,2}:\d{2}(?: [APap][Mm])?)\s+-\s+(.*?):\s+(.*)$/;

const testCases = [
  "1/23/24, 10:25 AM - Author: Message",
  "[23/1/24 10:25:34] Author: Message",
  "15/5/2023, 15:30 - Juan: Hola, cómo estás?",
  "15/5/2023 3:30 p. m. - Juan: Hola",
  "15/5/23, 3:30 p.m. - Juan: Hola",
  "[24/8/23, 10:14:15 a. m.] Juan: Hola",
  "‎15/‎05/‎2023, ‎15:‎30 - Juan: Hola", // LRM testing
  "\u200E15/\u200E05/\u200E2023, \u200E15:\u200E30 - Juan: Hola"
];

for (const tc of testCases) {
  console.log("Testing:", JSON.stringify(tc));
  console.log("  Android:", !!tc.match(androidRegex));
  console.log("  iOS:", !!tc.match(iosRegex));
}
