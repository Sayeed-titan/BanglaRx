import { useSyncExternalStore } from 'react';

export type Lang = 'bn' | 'en';

const KEY = 'banglarx.patient.lang';
let lang: Lang = (() => {
  try {
    return localStorage.getItem(KEY) === 'en' ? 'en' : 'bn';
  } catch {
    return 'bn';
  }
})();
const listeners = new Set<() => void>();

export function setLang(next: Lang) {
  lang = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* remembered for this visit only */
  }
  listeners.forEach((l) => l());
}

export function useLang(): Lang {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => lang,
  );
}

/** Bangla first. Every string has both; the toggle on every screen switches them. */
const T = {
  appName: { bn: 'BanglaRx রোগী', en: 'BanglaRx Patient' },
  hello: { bn: 'আসসালামু আলাইকুম', en: 'Hello' },
  signOut: { bn: 'সাইন আউট', en: 'Sign out' },
  back: { bn: 'পিছনে', en: 'Back' },
  cancel: { bn: 'বাতিল', en: 'Cancel' },
  loading: { bn: 'লোড হচ্ছে…', en: 'Loading…' },
  network: { bn: 'সার্ভারের সাথে যোগাযোগ করা যাচ্ছে না। ইন্টারনেট দেখে আবার চেষ্টা করুন।', en: "Can't reach the server. Check your internet and try again." },

  signInTitle: { bn: 'আপনার মোবাইল নম্বর দিন', en: 'Enter your mobile number' },
  signInLead: { bn: 'আমরা একটি ৬ সংখ্যার কোড এসএমএস করব। পাসওয়ার্ড লাগবে না।', en: "We'll text you a 6-digit code. No password needed." },
  phone: { bn: 'মোবাইল নম্বর', en: 'Mobile number' },
  phoneHelp: { bn: 'যেমন 01712345678', en: 'For example 01712345678' },
  sendCode: { bn: 'কোড পাঠান', en: 'Send the code' },
  codeTitle: { bn: 'কোডটি লিখুন', en: 'Enter the code' },
  codeLead: { bn: 'এই নম্বরে কোড পাঠানো হয়েছে:', en: 'We sent a code to:' },
  code: { bn: '৬ সংখ্যার কোড', en: '6-digit code' },
  verify: { bn: 'সাইন ইন', en: 'Sign in' },
  wrongNumber: { bn: 'ভুল নম্বর? বদলান', en: 'Wrong number? Change it' },
  resend: { bn: 'আবার কোড পাঠান', en: 'Send a new code' },
  privacy: { bn: 'আপনি শুধু নিজের এবং পরিবারের তথ্য দেখতে পাবেন।', en: 'You only ever see your own and your family’s information.' },

  myPeople: { bn: 'আমার পরিবার', en: 'My family' },
  noPeople: { bn: 'এই নম্বরে এখনও কেউ নেই। অ্যাপয়েন্টমেন্ট নিতে প্রথমে একজনকে যোগ করুন।', en: 'Nobody is on this number yet. Add a person first to book.' },
  addPerson: { bn: 'পরিবারের সদস্য যোগ করুন', en: 'Add a family member' },
  fullName: { bn: 'পুরো নাম', en: 'Full name' },
  age: { bn: 'বয়স', en: 'Age' },
  gender: { bn: 'লিঙ্গ', en: 'Gender' },
  Male: { bn: 'পুরুষ', en: 'Male' },
  Female: { bn: 'মহিলা', en: 'Female' },
  Other: { bn: 'অন্যান্য', en: 'Other' },
  save: { bn: 'সংরক্ষণ', en: 'Save' },
  years: { bn: 'বছর', en: 'yrs' },

  today: { bn: 'আজ', en: 'Today' },
  inLine: { bn: 'আজকের সিরিয়াল', en: 'Your place today' },
  yourToken: { bn: 'আপনার টোকেন', en: 'Your token' },
  nowServing: { bn: 'এখন দেখছেন', en: 'Now serving' },
  ahead: { bn: 'আপনার আগে অপেক্ষায়', en: 'Waiting ahead of you' },
  noOneYet: { bn: 'এখনও কেউ নয়', en: 'Nobody yet' },
  upcoming: { bn: 'আসন্ন অ্যাপয়েন্টমেন্ট', en: 'Upcoming appointments' },
  noUpcoming: { bn: 'কোনো আসন্ন অ্যাপয়েন্টমেন্ট নেই।', en: 'No upcoming appointments.' },
  past: { bn: 'আগের অ্যাপয়েন্টমেন্ট', en: 'Past appointments' },
  bookNew: { bn: 'অ্যাপয়েন্টমেন্ট নিন', en: 'Book an appointment' },
  cancelBooking: { bn: 'অ্যাপয়েন্টমেন্ট বাতিল', en: 'Cancel appointment' },
  cancelTooLate: { bn: 'সময় খুব কাছে। বাতিল করতে ক্লিনিকে ফোন করুন।', en: 'Too close to the time. Please call the clinic to cancel.' },
  cancelled: { bn: 'অ্যাপয়েন্টমেন্ট বাতিল হয়েছে।', en: 'The appointment was cancelled.' },
  booked: { bn: 'নিশ্চিত', en: 'Booked' },
  arrived: { bn: 'পৌঁছেছেন', en: 'Checked in' },
  completed: { bn: 'সম্পন্ন', en: 'Done' },
  cancelledState: { bn: 'বাতিল', en: 'Cancelled' },
  noshow: { bn: 'আসেননি', en: 'Missed' },

  choose: { bn: 'বেছে নিন', en: 'Choose' },
  chooseDoctor: { bn: 'ডাক্তার বেছে নিন', en: 'Choose a doctor' },
  noDoctors: { bn: 'এখন অনলাইনে অ্যাপয়েন্টমেন্ট নেওয়া যাচ্ছে না। ক্লিনিকে ফোন করুন।', en: 'Online booking is not open right now. Please call the clinic.' },
  nextFree: { bn: 'পরবর্তী খালি সময়', en: 'Next free time' },
  noFree: { bn: 'আগামী ৩০ দিনে খালি সময় নেই', en: 'No free time in the next 30 days' },
  fee: { bn: 'ফি', en: 'Fee' },
  chooseDay: { bn: 'দিন বেছে নিন', en: 'Choose a day' },
  chooseTime: { bn: 'সময় বেছে নিন', en: 'Choose a time' },
  noSlotsDay: { bn: 'এই দিনে খালি সময় নেই। অন্য দিন দেখুন।', en: 'No free times that day. Try another day.' },
  whoFor: { bn: 'কার জন্য?', en: 'Who is it for?' },
  reason: { bn: 'কী সমস্যা? (ঐচ্ছিক)', en: 'What is it about? (optional)' },
  confirm: { bn: 'নিশ্চিত করুন', en: 'Confirm' },
  review: { bn: 'দেখে নিন', en: 'Please check' },
  doneTitle: { bn: 'অ্যাপয়েন্টমেন্ট নিশ্চিত হয়েছে', en: 'Your appointment is booked' },
  doneLead: { bn: 'সময়মতো ক্লিনিকে পৌঁছে রিসেপশনে নাম বলুন।', en: 'Please arrive on time and give your name at reception.' },
  backHome: { bn: 'হোমে ফিরুন', en: 'Back to home' },
  sessionEnded: { bn: 'আপনার সেশন শেষ হয়েছে। আবার সাইন ইন করুন।', en: 'Your session ended. Please sign in again.' },
  myMeds: { bn: 'আমার প্রেসক্রিপশন', en: 'My prescriptions' },
  noRx: { bn: 'এখনো কোনো প্রেসক্রিপশন নেই। ডাক্তার সাইন করলে এখানে দেখা যাবে।', en: 'No prescriptions yet. They appear here once a doctor signs one.' },
  visitOn: { bn: 'ভিজিট', en: 'Visit' },
  diagnosisLbl: { bn: 'রোগ নির্ণয়', en: 'Diagnosis' },
  doctorAdvice: { bn: 'ডাক্তারের উপদেশ', en: "Doctor's advice" },
  followUpLbl: { bn: 'পরবর্তী সাক্ষাৎ', en: 'Next visit' },
  referredLbl: { bn: 'রেফার করা হয়েছে', en: 'Referred to' },
  medicinesLbl: { bn: 'ওষুধ', en: 'Medicines' },
  howOften: { bn: 'কখন খাবেন', en: 'When to take' },
  forDays: { bn: 'কতদিন', en: 'For how long' },
  howToTake: { bn: 'কীভাবে খাবেন', en: 'How to take' },
  morning: { bn: 'সকালে', en: 'morning' },
  noon: { bn: 'দুপুরে', en: 'noon' },
  night: { bn: 'রাতে', en: 'night' },
  sameIngredient: { bn: 'একই উপাদানের অন্য ব্র্যান্ড', en: 'Other brands with the same ingredient' },
  askBeforeChange: { bn: 'বদলানোর আগে ডাক্তার বা ফার্মাসিস্টকে জিজ্ঞাসা করুন।', en: 'Ask your doctor or pharmacist before switching.' },
  rxNote: { bn: 'এটি ডাক্তারের সাইন করা প্রেসক্রিপশন। ডাক্তারের কথা ছাড়া ওষুধ বদলাবেন না।', en: "This is exactly what your doctor signed. Don't change medicines without asking them." },
  myRxBtn: { bn: 'আমার প্রেসক্রিপশন দেখুন', en: 'View my prescriptions' },
  emergencyBtn: { bn: 'জরুরি অবস্থা?', en: 'Emergency?' },
  emergencyTitle: { bn: 'এখনই হাসপাতালের জরুরি বিভাগে যান', en: 'Go to a hospital emergency department now' },
  emergencyLead: { bn: 'বুকে চাপ বা ব্যথা, শ্বাসকষ্ট, অনেক রক্তপাত বা অজ্ঞান হয়ে যাওয়া জরুরি হতে পারে। অপেক্ষা না করে এখনই রওনা দিন। বুকিংয়ের জন্য সময় নষ্ট করবেন না।', en: 'Chest pain or pressure, trouble breathing, heavy bleeding or fainting can be an emergency. Do not wait. Leave now and do not spend time on booking.' },
  call999: { bn: '৯৯৯ এ কল করুন', en: 'Call 999' },
  emergencySteps: { bn: 'এখন যা করবেন', en: 'What to do now' },
  emergencyStep1: { bn: 'নিকটতম হাসপাতালের জরুরি বিভাগে যান বা ৯৯৯ এ কল করুন।', en: 'Go to the nearest hospital emergency department, or call 999.' },
  emergencyStep2: { bn: 'রোগীকে একা রাখবেন না।', en: 'Do not leave the patient alone.' },
  emergencyStep3: { bn: 'চলতি ওষুধ ও আগের প্রেসক্রিপশন সাথে নিন।', en: 'Take the current medicines and any earlier prescription with you.' },
  notADiagnosis: { bn: 'এটি রোগ নির্ণয় নয়। লক্ষণ দেখে সতর্ক থাকার পরামর্শ।', en: 'This is not a diagnosis. It is a warning to be careful.' },
  consentBtn: { bn: 'আমার অনুমতি', en: 'My permissions' },
  consentTitle: { bn: 'আপনার অনুমতি', en: 'Your permissions' },
  consentLead: { bn: 'ডাক্তারের সাথে কথা হলে সহজে প্রেসক্রিপশন লিখতে আমরা কণ্ঠস্বর রেকর্ড করতে পারি। আপনি যা চাইবেন তাই হবে।', en: 'We can record the conversation with the doctor to write the prescription more easily. It is your choice.' },
  recordVisit: { bn: 'আজকের ভিজিট রেকর্ড', en: 'Record my visit' },
  recordVisitHelp: { bn: 'শুধু ডাক্তার ও আপনি শুনতে পারবেন।', en: 'Only the doctor and you can hear it.' },
  yesRecord: { bn: 'হ্যাঁ, রেকর্ড করুন', en: 'Yes, record' },
  noRecord: { bn: 'না, করবেন না', en: 'No, do not record' },
  noRecordNote: { bn: 'ঠিক আছে। ডাক্তার হাতে লিখে প্রেসক্রিপশন তৈরি করবেন। আপনার চিকিৎসায় কোনো পার্থক্য হবে না।', en: 'That is fine. The doctor will write the prescription by hand. Your treatment will not change.' },
  remindersLbl: { bn: 'ওষুধের রিমাইন্ডার', en: 'Medicine reminders' },
  remindersHelp: { bn: 'সময়মতো মনে করিয়ে দেব', en: 'We will remind you on time' },
  storeReportsLbl: { bn: 'রিপোর্ট সংরক্ষণ', en: 'Keep my reports' },
  storeReportsHelp: { bn: 'আপনার দেওয়া রিপোর্ট নিরাপদে রাখব', en: 'We keep the reports you give us safely' },
  consentFoot: { bn: 'যেকোনো সময় বদলাতে পারবেন। প্রতিটি পছন্দ তারিখসহ সংরক্ষিত থাকে।', en: 'You can change this any time. Every choice is saved with its date.' },
  lastSaved: { bn: 'সর্বশেষ সংরক্ষণ', en: 'Last saved' },
  answerFirst: { bn: 'আগে রেকর্ডের উত্তর দিন', en: 'Answer the recording question first' },
  saveChoices: { bn: 'আমার পছন্দ সংরক্ষণ করুন', en: 'Save my choices' },
  consentSaved: { bn: 'সংরক্ষিত হয়েছে।', en: 'Saved.' },
  language: { bn: 'ভাষা', en: 'Language' },
} as const;

export type Key = keyof typeof T;
export const tr = (l: Lang, key: Key): string => T[key][l];

const DIGITS = '০১২৩৪৫৬৭৮৯';
/** Bangla digits when the page is in Bangla. */
export const num = (l: Lang, n: number | string): string => (l === 'bn' ? String(n).replace(/\d/g, (d) => DIGITS[+d]) : String(n));

export function fmtDate(l: Lang, iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(l === 'bn' ? 'bn-BD' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function fmtTime(l: Lang, hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(2000, 0, 1, h, m);
  return d.toLocaleTimeString(l === 'bn' ? 'bn-BD' : 'en-GB', { hour: 'numeric', minute: '2-digit', hour12: true });
}
