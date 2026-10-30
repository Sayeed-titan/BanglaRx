import type { Lang } from '../patient/i18n';

/**
 * Everything the public home page says, in both languages. It only describes what the product does today:
 * no invented statistics, no promised results. The one set of numbers is our own internal test, labelled as such.
 */
export interface Point {
  title: string;
  text: string;
}

export interface Copy {
  nav: { patients: string; doctors: string; clinics: string; how: string; staffSignIn: string; patientSignIn: string };
  hero: { kicker: string; title: string; lead: string; find: string; clinicsCta: string; note: string };
  patients: { kicker: string; title: string; lead: string; points: Point[] };
  doctors: { kicker: string; title: string; lead: string; points: Point[]; proofTitle: string; proof: string[]; proofNote: string };
  clinics: { kicker: string; title: string; lead: string; points: Point[]; impactTitle: string; impact: Point[] };
  calc: {
    title: string;
    lead: string;
    doctors: string;
    patients: string;
    minutes: string;
    saved: string;
    fee: string;
    days: string;
    resultTitle: string;
    freed: string;
    extra: string;
    income: string;
    perMonth: string;
    hours: string;
    note: string;
    needMore: string;
  };
  how: { title: string; patientTitle: string; patientSteps: string[]; clinicTitle: string; clinicSteps: string[] };
  trust: { title: string; points: Point[] };
  cta: { title: string; lead: string; staff: string; patient: string; find: string };
  footer: string;
}

export const COPY: Record<Lang, Copy> = {
  en: {
    nav: { patients: 'Patients', doctors: 'Doctors', clinics: 'Clinics and hospitals', how: 'How it works', staffSignIn: 'Staff sign in', patientSignIn: 'Patient sign in' },
    hero: {
      kicker: 'Patients · Doctors · Clinics',
      title: 'The right doctor, the right time, a prescription you can follow.',
      lead: 'BanglaRx brings patients, doctors and clinic staff into one calm system. Speak or type in Bangla, English or Banglish.',
      find: 'Find a doctor',
      clinicsCta: 'See what it does for a clinic',
      note: 'No app store needed. Add it to your phone like an app.',
    },
    patients: {
      kicker: 'For patients',
      title: 'Know who to see, book it yourself, understand your medicine.',
      lead: 'Everything you need before, during and after the visit, in Bangla or English.',
      points: [
        { title: 'Ask Rubina which doctor to see', text: 'Describe the problem. Rubina tells you the specialty, the doctor, the place, the fee and the next free time. She never diagnoses and never suggests medicines.' },
        { title: 'Book in a minute', text: 'Sign in with a code sent to your phone. No password. Book for yourself or for family, and see only the times that are really free.' },
        { title: 'See your place in line', text: 'On the day, your token number and how many people are ahead of you.' },
        { title: 'Read your prescription in plain words', text: 'When to take each medicine, for how long, and other brands with the same ingredient, so you can ask your pharmacist.' },
        { title: 'Keep your reports', text: 'Take a photo of a report. You check the values it read. They are kept only if you allow it, and the photo is never stored.' },
        { title: 'You stay in control', text: 'Choose whether your visit may be recorded, whether to get reminders, and whether we keep your reports. Every choice is saved with its date.' },
      ],
    },
    doctors: {
      kicker: 'For doctors',
      title: 'Talk to your patient. Review the prescription. Sign.',
      lead: 'The AI writes down only what was said. Anything it did not hear stays blank. You edit every field and you decide.',
      points: [
        { title: 'A draft in seconds', text: 'Speak or type the consultation. Complaints, diagnosis, medicines, tests and advice appear on the pad for you to review.' },
        { title: 'Checks before you sign', text: 'Allergies, double ingredients, drug interactions and doses for age and weight are checked by fixed rules, not by guesswork.' },
        { title: 'Medicines matched to the formulary', text: 'Every medicine is matched with its brand and strength. When a name is unclear you get the choices; nothing is guessed.' },
        { title: 'Fast for follow-ups', text: 'Repeat the last prescription, apply your own templates, use keyboard shortcuts.' },
        { title: 'Rx Sathi at your side', text: 'Ask about a dose or an interaction with the patient chart in view. Suggestions come only from your formulary and allergy conflicts are removed.' },
        { title: 'A record you can trust', text: 'Every change makes a new version and the earlier one is kept. You also see what the patient allowed, and the reports they brought.' },
      ],
      proofTitle: 'What we measured',
      proof: ['97% of medicines matched correctly', '100% correct dosage patterns', '0 invented fields', 'About 9 seconds for a draft (median)'],
      proofNote: 'Our own test: 30 Bangla and Banglish dictations on a limited formulary. Your results will depend on your setting; run a pilot to see them.',
    },
    clinics: {
      kicker: 'For clinics and hospitals',
      title: 'A calmer front desk, fuller sessions, and clear records.',
      lead: 'Set your doctors and sessions once. Patients, reception, doctors and pharmacy all work from the same picture.',
      points: [
        { title: 'Online booking that fills your sessions', text: 'Patients see only free times for doctors you have switched on. Two people can never get the same slot.' },
        { title: 'One queue', text: 'Reception checks people in and a token is issued. Patients see their place, so the waiting room is quieter.' },
        { title: 'A reception inbox', text: 'Rubina answers the common questions about doctors, fees and times. When a patient wants a person, reception takes over the same chat.' },
        { title: 'Doctors, branches and schedules in one place', text: 'Sessions, fees, leave and which doctors take online bookings.' },
        { title: 'Pharmacy hand-over records', text: 'Who handed over which medicine, and when. A warning appears if the doctor changed the prescription afterwards.' },
        { title: 'Each person sees only their work', text: 'Doctor, assistant, receptionist, pharmacist and manager have their own screens. Sign-ins are logged.' },
      ],
      impactTitle: 'What changes in your clinic',
      impact: [
        { title: 'Less time on the phone', text: 'Common questions are answered before they reach reception.' },
        { title: 'Fewer empty slots', text: 'Patients can book at any hour, and see exactly what is free.' },
        { title: 'Shorter consultations', text: 'Doctors review a draft instead of typing every line, so the same session can see more patients, or give each one more time.' },
        { title: 'Fewer prescription errors', text: 'Allergy, duplicate and dose checks run before the prescription is signed.' },
        { title: 'Clear accountability', text: 'Every revision and every hand-over is on record.' },
        { title: 'A visible picture of the day', text: 'The overview shows the queue, bookings and who is waiting.' },
      ],
    },
    calc: {
      title: 'Estimate it for your clinic',
      lead: 'Type your own numbers. This is plain arithmetic, not a promise. The time saved per patient is your own estimate: measure it in a one-week trial.',
      doctors: 'Doctors',
      patients: 'Patients per doctor per day',
      minutes: 'Minutes per consultation now',
      saved: 'Minutes you expect to save per patient',
      fee: 'Fee per consultation (৳)',
      days: 'Working days per month',
      resultTitle: 'With your numbers',
      freed: 'Doctor time freed each day',
      extra: 'Extra consultations a month, if the freed time is used for patients',
      income: 'Extra fees a month, at the same fee',
      perMonth: 'a month',
      hours: 'hours',
      note: 'If you use the time for longer consultations instead, the fees stay the same and each patient gets more attention.',
      needMore: 'Enter numbers above zero to see the estimate.',
    },
    how: {
      title: 'How it works',
      patientTitle: 'For a patient',
      patientSteps: ['Ask Rubina which doctor to see', 'Sign in with your phone code and book a free time', 'Arrive, see your place in line, and read your prescription afterwards'],
      clinicTitle: 'For a clinic',
      clinicSteps: ['Add doctors, branches and sessions', 'Patients book, reception checks them in, doctors consult and sign', 'The pharmacy hands over, and everything is on record'],
    },
    trust: {
      title: 'Built so doctors stay in charge',
      points: [
        { title: 'The AI drafts, the doctor decides', text: 'Nothing is final until a doctor signs. Every field can be changed.' },
        { title: 'Blank means not recorded', text: 'The system never fills in vitals, tests, doses or advice that nobody said.' },
        { title: 'Private by design', text: 'Recording needs the patient’s yes. The public chat cannot see anyone’s records. Reports are kept only with permission.' },
        { title: 'Emergency first', text: 'If someone describes an emergency, the chat tells them to go to the nearest emergency department or call 999, and does not talk about booking.' },
      ],
    },
    cta: { title: 'Start here', lead: 'Patients can look for a doctor right now. Clinic staff sign in to their own screens.', staff: 'Staff sign in', patient: 'Patient sign in', find: 'Find a doctor' },
    footer: 'BanglaRx · AI assists, the doctor decides.',
  },
  bn: {
    nav: { patients: 'রোগী', doctors: 'ডাক্তার', clinics: 'ক্লিনিক ও হাসপাতাল', how: 'কীভাবে কাজ করে', staffSignIn: 'স্টাফ সাইন ইন', patientSignIn: 'রোগী সাইন ইন' },
    hero: {
      kicker: 'রোগী · ডাক্তার · ক্লিনিক',
      title: 'সঠিক ডাক্তার, সঠিক সময়, বুঝে নেওয়ার মতো প্রেসক্রিপশন।',
      lead: 'BanglaRx রোগী, ডাক্তার ও ক্লিনিক স্টাফকে এক শান্ত সিস্টেমে আনে। বাংলা, ইংরেজি বা বাংলিশে বলুন বা লিখুন।',
      find: 'ডাক্তার খুঁজুন',
      clinicsCta: 'ক্লিনিকের জন্য কী করে দেখুন',
      note: 'অ্যাপ স্টোর লাগবে না। ফোনে অ্যাপের মতো যোগ করে নিন।',
    },
    patients: {
      kicker: 'রোগীর জন্য',
      title: 'কাকে দেখাবেন জানুন, নিজেই বুক করুন, ওষুধ বুঝে নিন।',
      lead: 'ভিজিটের আগে, ভিজিটে ও পরে যা দরকার, বাংলা বা ইংরেজিতে।',
      points: [
        { title: 'রুবিনাকে জিজ্ঞাসা করুন কোন ডাক্তার', text: 'সমস্যার কথা লিখুন। রুবিনা বলবে কোন বিশেষজ্ঞ, কোথায়, ফি কত ও পরবর্তী খালি সময়। সে রোগ নির্ণয় বা ওষুধ বলে না।' },
        { title: 'এক মিনিটে বুক', text: 'ফোনে কোড এসে যাবে, পাসওয়ার্ড লাগবে না। নিজের বা পরিবারের জন্য বুক করুন, শুধু সত্যিকারের খালি সময় দেখবেন।' },
        { title: 'লাইনে নিজের জায়গা দেখুন', text: 'ভিজিটের দিন আপনার টোকেন ও সামনে কতজন আছে।' },
        { title: 'প্রেসক্রিপশন সহজ ভাষায় পড়ুন', text: 'কোন ওষুধ কখন, কতদিন, আর একই উপাদানের অন্য ব্র্যান্ড, যাতে ফার্মাসিস্টকে জিজ্ঞাসা করতে পারেন।' },
        { title: 'রিপোর্ট সংরক্ষণ', text: 'রিপোর্টের ছবি তুলুন। পড়া মানগুলো আপনি দেখে নিন। অনুমতি দিলেই রাখা হয়, ছবি কখনো রাখা হয় না।' },
        { title: 'নিয়ন্ত্রণ আপনার হাতে', text: 'ভিজিট রেকর্ড হবে কি না, রিমাইন্ডার চাই কি না, রিপোর্ট রাখা হবে কি না, আপনি ঠিক করুন। প্রতিটি পছন্দ তারিখসহ সংরক্ষিত থাকে।' },
      ],
    },
    doctors: {
      kicker: 'ডাক্তারের জন্য',
      title: 'রোগীর সাথে কথা বলুন। প্রেসক্রিপশন দেখে নিন। সাইন করুন।',
      lead: 'এআই শুধু যা বলা হয়েছে তাই লেখে। যা শোনেনি তা ফাঁকা থাকে। প্রতিটি ঘর আপনি বদলাতে পারেন, সিদ্ধান্ত আপনার।',
      points: [
        { title: 'কয়েক সেকেন্ডে খসড়া', text: 'কথা বলুন বা লিখুন। উপসর্গ, রোগ নির্ণয়, ওষুধ, পরীক্ষা ও উপদেশ প্যাডে আসবে, আপনি দেখে নেবেন।' },
        { title: 'সাইনের আগে যাচাই', text: 'অ্যালার্জি, একই উপাদান দুবার, ওষুধের মিথস্ক্রিয়া ও বয়স-ওজনের মাত্রা নির্দিষ্ট নিয়মে যাচাই হয়, আন্দাজে নয়।' },
        { title: 'ফর্মুলারির সাথে মিল', text: 'প্রতিটি ওষুধ ব্র্যান্ড ও শক্তিসহ মেলানো হয়। নাম অস্পষ্ট হলে বিকল্প দেখায়, আন্দাজ করে না।' },
        { title: 'ফলো-আপে দ্রুত', text: 'আগের প্রেসক্রিপশন আবার ব্যবহার, নিজের টেমপ্লেট, কিবোর্ড শর্টকাট।' },
        { title: 'পাশে Rx সাথী', text: 'রোগীর চার্ট দেখে মাত্রা বা মিথস্ক্রিয়ার প্রশ্ন করুন। পরামর্শ আসে শুধু আপনার ফর্মুলারি থেকে, অ্যালার্জির ওষুধ বাদ যায়।' },
        { title: 'ভরসার রেকর্ড', text: 'প্রতিটি পরিবর্তনে নতুন সংস্করণ হয়, আগেরটি থাকে। রোগীর অনুমতি ও আনা রিপোর্টও দেখতে পাবেন।' },
      ],
      proofTitle: 'আমরা যা মেপেছি',
      proof: ['৯৭% ওষুধ ঠিকমতো মিলেছে', '১০০% ডোজ প্যাটার্ন ঠিক', '০টি বানানো ঘর', 'খসড়া প্রায় ৯ সেকেন্ডে (মধ্যমান)'],
      proofNote: 'আমাদের নিজস্ব পরীক্ষা: সীমিত ফর্মুলারিতে ৩০টি বাংলা ও বাংলিশ ডিকটেশন। আপনার ক্ষেত্রে ফল ভিন্ন হতে পারে, পাইলট করে দেখুন।',
    },
    clinics: {
      kicker: 'ক্লিনিক ও হাসপাতালের জন্য',
      title: 'শান্ত ফ্রন্ট ডেস্ক, ভরা সেশন, পরিষ্কার রেকর্ড।',
      lead: 'ডাক্তার ও সেশন একবার ঠিক করুন। রোগী, রিসেপশন, ডাক্তার ও ফার্মেসি সবাই একই ছবি দেখে কাজ করে।',
      points: [
        { title: 'অনলাইন বুকিংয়ে সেশন ভরে', text: 'আপনি যাদের চালু করেছেন সেই ডাক্তারদের খালি সময়ই রোগী দেখে। একই সময় দুজন পেতে পারে না।' },
        { title: 'একটি সারি', text: 'রিসেপশন চেক-ইন করালে টোকেন হয়। রোগী নিজের জায়গা দেখে, তাই অপেক্ষার ঘর শান্ত থাকে।' },
        { title: 'রিসেপশন ইনবক্স', text: 'ডাক্তার, ফি ও সময়ের সাধারণ প্রশ্নের উত্তর রুবিনা দেয়। রোগী মানুষ চাইলে রিসেপশন একই চ্যাটে কথা বলে।' },
        { title: 'ডাক্তার, ব্রাঞ্চ ও সময়সূচি এক জায়গায়', text: 'সেশন, ফি, ছুটি ও কোন ডাক্তার অনলাইন বুকিং নেন।' },
        { title: 'ফার্মেসি হ্যান্ড-ওভার রেকর্ড', text: 'কে কোন ওষুধ কখন দিয়েছে। ডাক্তার পরে প্রেসক্রিপশন বদলালে সতর্কতা আসে।' },
        { title: 'প্রত্যেকে শুধু নিজের কাজ দেখে', text: 'ডাক্তার, সহকারী, রিসেপশনিস্ট, ফার্মাসিস্ট ও ম্যানেজারের আলাদা স্ক্রিন। সাইন ইনের লগ থাকে।' },
      ],
      impactTitle: 'আপনার ক্লিনিকে কী বদলায়',
      impact: [
        { title: 'ফোনে কম সময়', text: 'সাধারণ প্রশ্নের উত্তর রিসেপশনে পৌঁছানোর আগেই হয়ে যায়।' },
        { title: 'ফাঁকা সময় কম', text: 'রোগী যেকোনো সময় বুক করতে পারে এবং ঠিক কী খালি তা দেখে।' },
        { title: 'ছোট কনসালটেশন', text: 'ডাক্তার প্রতিটি লাইন টাইপ না করে খসড়া দেখে নেন, তাই একই সেশনে বেশি রোগী বা প্রতিজনকে বেশি সময় দেওয়া যায়।' },
        { title: 'প্রেসক্রিপশনে ভুল কম', text: 'সাইনের আগে অ্যালার্জি, দ্বৈত ওষুধ ও মাত্রা যাচাই হয়।' },
        { title: 'স্পষ্ট দায়বদ্ধতা', text: 'প্রতিটি সংশোধন ও প্রতিটি হ্যান্ড-ওভার রেকর্ডে থাকে।' },
        { title: 'দিনের পরিষ্কার ছবি', text: 'ওভারভিউতে সারি, বুকিং ও কে অপেক্ষায় তা দেখা যায়।' },
      ],
    },
    calc: {
      title: 'আপনার ক্লিনিকের জন্য হিসাব করুন',
      lead: 'নিজের সংখ্যা বসান। এটি সাধারণ অঙ্ক, কোনো প্রতিশ্রুতি নয়। প্রতি রোগীতে সময় বাঁচা আপনার নিজের অনুমান, এক সপ্তাহের ট্রায়ালে মেপে দেখুন।',
      doctors: 'ডাক্তার সংখ্যা',
      patients: 'প্রতি ডাক্তারের দৈনিক রোগী',
      minutes: 'এখন প্রতি কনসালটেশনে মিনিট',
      saved: 'প্রতি রোগীতে কত মিনিট বাঁচবে বলে মনে করেন',
      fee: 'প্রতি কনসালটেশনের ফি (৳)',
      days: 'মাসে কর্মদিবস',
      resultTitle: 'আপনার সংখ্যায়',
      freed: 'প্রতিদিন ডাক্তারের সময় বাঁচে',
      extra: 'বাঁচা সময়ে রোগী দেখলে মাসে বাড়তি কনসালটেশন',
      income: 'একই ফিতে মাসে বাড়তি আয়',
      perMonth: 'প্রতি মাসে',
      hours: 'ঘণ্টা',
      note: 'এই সময় লম্বা কনসালটেশনে ব্যবহার করলে আয় একই থাকে, কিন্তু প্রতি রোগী বেশি মনোযোগ পান।',
      needMore: 'হিসাব দেখতে শূন্যের বেশি সংখ্যা দিন।',
    },
    how: {
      title: 'কীভাবে কাজ করে',
      patientTitle: 'রোগীর জন্য',
      patientSteps: ['রুবিনাকে জিজ্ঞাসা করুন কোন ডাক্তার', 'ফোনের কোড দিয়ে সাইন ইন করে খালি সময় বুক করুন', 'গিয়ে লাইনে নিজের জায়গা দেখুন, পরে প্রেসক্রিপশন পড়ুন'],
      clinicTitle: 'ক্লিনিকের জন্য',
      clinicSteps: ['ডাক্তার, ব্রাঞ্চ ও সেশন যোগ করুন', 'রোগী বুক করে, রিসেপশন চেক-ইন করায়, ডাক্তার দেখে ও সাইন করেন', 'ফার্মেসি ওষুধ দেয়, সবকিছু রেকর্ডে থাকে'],
    },
    trust: {
      title: 'ডাক্তার যাতে নিয়ন্ত্রণে থাকেন',
      points: [
        { title: 'এআই খসড়া করে, ডাক্তার সিদ্ধান্ত নেন', text: 'ডাক্তার সাইন না করা পর্যন্ত কিছুই চূড়ান্ত নয়। প্রতিটি ঘর বদলানো যায়।' },
        { title: 'ফাঁকা মানে লেখা হয়নি', text: 'যা কেউ বলেনি সেই ভাইটাল, পরীক্ষা, মাত্রা বা উপদেশ সিস্টেম নিজে বসায় না।' },
        { title: 'গোপনীয়তা শুরু থেকেই', text: 'রেকর্ড করতে রোগীর হ্যাঁ লাগে। পাবলিক চ্যাট কারও রেকর্ড দেখতে পায় না। রিপোর্ট অনুমতি ছাড়া রাখা হয় না।' },
        { title: 'জরুরি অবস্থা আগে', text: 'কেউ জরুরি অবস্থার কথা লিখলে চ্যাট নিকটতম জরুরি বিভাগে যেতে বা ৯৯৯ এ কল করতে বলে, বুকিংয়ের কথা বলে না।' },
      ],
    },
    cta: { title: 'এখান থেকে শুরু করুন', lead: 'রোগীরা এখনই ডাক্তার খুঁজতে পারেন। ক্লিনিক স্টাফ নিজের স্ক্রিনে সাইন ইন করেন।', staff: 'স্টাফ সাইন ইন', patient: 'রোগী সাইন ইন', find: 'ডাক্তার খুঁজুন' },
    footer: 'BanglaRx · এআই সহায়তা করে, ডাক্তার সিদ্ধান্ত নেন।',
  },
};
