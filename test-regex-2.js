const androidRegex = /^(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}[, ]+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[aA]\.?\s*[mM]\.?|\s*[pP]\.?\s*[mM]\.?)?)\s+-\s+(.*?):\s+(.*)$/;
const iosRegex = /^\[(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}[, ]+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[aA]\.?\s*[mM]\.?|\s*[pP]\.?\s*[mM]\.?)?)\]\s+(.*?):\s+(.*)$/;

const tcs = [
  "1/23/24, 10:25 AM - Author: Message",
  "[23/1/24 10:25:34] Author: Message",
  "15/5/2023, 15:30 - Juan: Hola, cómo estás?",
  "15/5/2023 3:30 p. m. - Juan: Hola",
  "15/5/23, 3:30 p.m. - Juan: Hola",
  "[24/8/23, 10:14:15 a. m.] Juan: Hola",
  "15/05/2023, 15:30 - Juan: Hola",
  "15/05/2023, 15:30 - Juan: Hola"
];

for (const t of tcs) {
  console.log(t, "-> android:", !!t.match(androidRegex), "ios:", !!t.match(iosRegex));
}
