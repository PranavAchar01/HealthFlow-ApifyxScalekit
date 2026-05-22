"use client";
import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type EmergencyContact = { name: string; relationship: string; phone: string };
type TranscriptLine = { speaker: "Dispatcher" | "Caller"; text: string };
type NotesSummary = { chiefComplaint: string; vitals?: string; patientHistory: string; currentMedications: string; allergies: string; callerRelationship: string; keyObservations: string; priority: string };
type Patient = { id: string; name: string; age: number | null; sex: string; dob: string; patientId: string; phone: string; address: string; email: string; language: string; risk: "HIGH" | "MED" | "LOW" | "UNKNOWN"; chiefComplaint: string; conditions: string[]; medications: string[]; allergies: string[]; avatar: string; avatarBg: string; emergencyContact: EmergencyContact | null; note?: string; transcriptLines: TranscriptLine[]; notesSummary: NotesSummary; isUnknownPatient: boolean };

const INITIAL_PATIENTS: Patient[] = [
  {
    id: "stroke",
    name: "Elena Vasquez",
    age: 71, sex: "F", dob: "04/12/1953",
    patientId: "PT-20240101",
    phone: "(415) 555-0182",
    address: "2348 Sacramento St, San Francisco CA 94115",
    email: "e.vasquez@gmail.com",
    language: "English/Spanish",
    risk: "HIGH",
    chiefComplaint: "Suspected Stroke",
    conditions: ["Atrial Fibrillation", "Hypertension", "Type 2 Diabetes"],
    medications: ["Warfarin 5mg", "Lisinopril 10mg", "Metformin 500mg"],
    allergies: ["Penicillin"],
    avatar: "EV",
    avatarBg: "bg-blue-600",
    emergencyContact: { name: "Marco Vasquez", relationship: "Son", phone: "(415) 555-0193" },
    isUnknownPatient: false,
    transcriptLines: [
      { speaker: "Dispatcher", text: "911, what is your emergency?" },
      { speaker: "Caller", text: "My mother — she can't move her left arm and her face is drooping. She was trying to say something and it came out all wrong. Please hurry." },
      { speaker: "Dispatcher", text: "I understand. What is the address?" },
      { speaker: "Caller", text: "2348 Sacramento Street, San Francisco. We're on the second floor, apartment 2B." },
      { speaker: "Dispatcher", text: "How long has she had these symptoms?" },
      { speaker: "Caller", text: "Maybe 15, 20 minutes. She was watching TV and then just — she called out to me and I found her like this." },
      { speaker: "Dispatcher", text: "Is she conscious and breathing?" },
      { speaker: "Caller", text: "Yes, she's awake, she's looking at me. Her breathing seems okay but she looks terrified." },
      { speaker: "Dispatcher", text: "Does she have any medical conditions or take blood thinners?" },
      { speaker: "Caller", text: "Yes, she's on Warfarin — she has atrial fibrillation. And she's diabetic, takes Metformin. She's allergic to Penicillin." },
      { speaker: "Dispatcher", text: "Do not give her anything to eat or drink. Keep her still and calm. Units are being dispatched now — ETA approximately 6 minutes." },
      { speaker: "Caller", text: "Okay, okay. Should I unlock the front door?" },
      { speaker: "Dispatcher", text: "Yes, unlock the door now and stay on the line with me until paramedics arrive." },
    ],
    notesSummary: {
      chiefComplaint: "Suspected stroke — left-sided facial droop, left arm weakness, expressive aphasia",
      vitals: "Not yet obtained; patient conscious and breathing",
      patientHistory: "Atrial fibrillation, Hypertension, Type 2 Diabetes",
      currentMedications: "Warfarin 5mg, Lisinopril 10mg, Metformin 500mg",
      allergies: "Penicillin",
      callerRelationship: "Son (Marco Vasquez) called on behalf of patient",
      keyObservations: "Symptom onset approx 20 min prior to call. Patient alert but aphasic. Warfarin on board — critical for stroke team. Do not delay CT.",
      priority: "HIGH — Time-sensitive stroke protocol. Notify stroke team en route.",
    },
  },
  {
    id: "chest",
    name: "Bernard Okafor",
    age: 58, sex: "M", dob: "01/29/1966",
    patientId: "PT-20240102",
    phone: "(510) 555-0247",
    address: "4701 Telegraph Ave, Oakland CA 94609",
    email: "b.okafor@outlook.com",
    language: "English",
    risk: "HIGH",
    chiefComplaint: "Acute Chest Pain",
    conditions: ["Hypertension", "Hyperlipidemia"],
    medications: ["Atorvastatin 40mg", "Amlodipine 5mg"],
    allergies: ["Sulfa drugs"],
    avatar: "BO",
    avatarBg: "bg-red-600",
    emergencyContact: { name: "Adaeze Okafor", relationship: "Wife", phone: "(510) 555-0261" },
    isUnknownPatient: false,
    transcriptLines: [
      { speaker: "Dispatcher", text: "911, what is your emergency?" },
      { speaker: "Caller", text: "I'm having really bad chest pain. It's crushing — going into my left arm. I'm sweating and I feel like I'm going to pass out." },
      { speaker: "Dispatcher", text: "Sir, stay calm. What is your address?" },
      { speaker: "Caller", text: "4701 Telegraph Avenue, Oakland. I'm on the ground floor." },
      { speaker: "Dispatcher", text: "Are you alone right now?" },
      { speaker: "Caller", text: "Yes. I called my wife but she's not picking up. I drove home from work and the pain started when I parked." },
      { speaker: "Dispatcher", text: "Do not drive. Sit or lie down. How long has the pain been going on?" },
      { speaker: "Caller", text: "About 40 minutes. It keeps getting worse. I took one of my wife's aspirin — is that okay?" },
      { speaker: "Dispatcher", text: "That's fine. Do you have any heart conditions or take any medications?" },
      { speaker: "Caller", text: "High blood pressure, high cholesterol. I take Atorvastatin and Amlodipine. I'm allergic to Sulfa drugs." },
      { speaker: "Dispatcher", text: "Paramedics are on their way. Unlock your door if you can. Do not eat or drink anything." },
      { speaker: "Caller", text: "Okay. The door is unlocked. Hurry, please — the pain is really bad." },
      { speaker: "Dispatcher", text: "I'm staying with you. Units are 5 minutes out. Keep talking to me." },
    ],
    notesSummary: {
      chiefComplaint: "Acute crushing chest pain with radiation to left arm, diaphoresis — STEMI protocol indicated",
      vitals: "Not obtained by caller; patient ambulatory but diaphoretic and near-syncopal",
      patientHistory: "Hypertension, Hyperlipidemia",
      currentMedications: "Atorvastatin 40mg, Amlodipine 5mg. Aspirin taken by patient prior to EMS arrival",
      allergies: "Sulfa drugs",
      callerRelationship: "Patient calling himself",
      keyObservations: "Onset 40 min, patient home alone, door unlocked. Classic ACS presentation. 12-lead priority on arrival.",
      priority: "HIGH — Activate cath lab on scene confirmation of STEMI.",
    },
  },
  {
    id: "trauma",
    name: "Derek Sato",
    age: 34, sex: "M", dob: "08/17/1990",
    patientId: "PT-20240103",
    phone: "(650) 555-0319",
    address: "I-880 N near 23rd Ave Overpass, Oakland CA",
    email: "d.sato@gmail.com",
    language: "English",
    risk: "HIGH",
    chiefComplaint: "Blunt Trauma - MVA",
    conditions: [],
    medications: [],
    allergies: [],
    avatar: "DS",
    avatarBg: "bg-orange-600",
    emergencyContact: { name: "Yuki Sato", relationship: "Sister", phone: "(650) 555-0328" },
    isUnknownPatient: false,
    transcriptLines: [
      { speaker: "Dispatcher", text: "911, what is your emergency?" },
      { speaker: "Caller", text: "There's been a bad accident on 880 North near the 23rd Avenue overpass. Two cars. One driver is still inside and he's not moving." },
      { speaker: "Dispatcher", text: "Are you the driver or a bystander?" },
      { speaker: "Caller", text: "I'm a bystander. I pulled over. The driver of the silver sedan is conscious but he's dazed. He's bleeding from his head." },
      { speaker: "Dispatcher", text: "Is the vehicle stable? Is there any fire or smoke?" },
      { speaker: "Caller", text: "No fire. The car is on the shoulder, airbags deployed. He says his leg hurts really bad and he can't move it." },
      { speaker: "Dispatcher", text: "Do not move him. Keep bystanders back and keep him still. Can you see if he's wearing a seatbelt?" },
      { speaker: "Caller", text: "He was — the belt is still on. He's asking me what happened. He seems confused." },
      { speaker: "Dispatcher", text: "How old does he appear and does he know his name?" },
      { speaker: "Caller", text: "He says his name is Derek, looks mid-30s. He has a wallet — says his emergency contact is his sister Yuki." },
      { speaker: "Dispatcher", text: "CHP and EMS are being dispatched now. ETA 7 minutes. Stay with him and keep him calm." },
      { speaker: "Caller", text: "Got it. He's still talking but he looks pale. There's a lot of blood from the head wound." },
      { speaker: "Dispatcher", text: "Apply gentle pressure to the head wound with cloth if you have it. Do not press on the neck or spine." },
    ],
    notesSummary: {
      chiefComplaint: "High-speed MVA, restrained driver, airbag deployed — head laceration, suspected right leg fracture",
      vitals: "Not obtained; patient conscious but confused (GCS estimated 13), pallor noted",
      patientHistory: "None known",
      currentMedications: "None known",
      allergies: "None known",
      callerRelationship: "Bystander who witnessed accident",
      keyObservations: "Altered mental status post-impact, cervical spine precautions required, active head bleed, suspected femur fracture right leg. ID from wallet on scene.",
      priority: "HIGH — Trauma activation. C-spine protocol. CT head priority.",
    },
  },
  {
    id: "diabetic",
    name: "Priya Nair",
    age: 43, sex: "F", dob: "03/05/1981",
    patientId: "PT-20240104",
    phone: "(408) 555-0472",
    address: "890 Leigh Ave, San Jose CA 95128",
    email: "p.nair@yahoo.com",
    language: "English",
    risk: "MED",
    chiefComplaint: "Diabetic Emergency / Hypoglycemia",
    conditions: ["Type 1 Diabetes", "Hypothyroidism"],
    medications: ["Insulin Glargine 20 units", "Levothyroxine 75mcg"],
    allergies: [],
    avatar: "PN",
    avatarBg: "bg-teal-600",
    emergencyContact: { name: "Arjun Nair", relationship: "Husband", phone: "(408) 555-0481" },
    isUnknownPatient: false,
    transcriptLines: [
      { speaker: "Dispatcher", text: "911, what is your emergency?" },
      { speaker: "Caller", text: "My wife is a diabetic and she's not making sense. She's sweating and shaking and she can't answer me properly." },
      { speaker: "Dispatcher", text: "What is your address?" },
      { speaker: "Caller", text: "890 Leigh Avenue in San Jose, 95128." },
      { speaker: "Dispatcher", text: "Is she conscious? Can she swallow?" },
      { speaker: "Caller", text: "She's awake but really confused. She kept saying she was fine and then she just went limp. I gave her juice about 5 minutes ago." },
      { speaker: "Dispatcher", text: "Good. Do you have a glucometer? What is her blood sugar?" },
      { speaker: "Caller", text: "I checked — it says 31. She took her insulin this morning but skipped lunch because she had a meeting." },
      { speaker: "Dispatcher", text: "Do you know what medications she takes?" },
      { speaker: "Caller", text: "Insulin Glargine and Levothyroxine. She has Type 1. No allergies." },
      { speaker: "Dispatcher", text: "Do not give her anything else to eat or drink right now. EMS is on the way — ETA 4 minutes." },
      { speaker: "Caller", text: "She's a little more alert now. She recognized me. But she's still shaking." },
      { speaker: "Dispatcher", text: "That is a good sign. Keep her lying down, keep talking to her. Stay on the line." },
    ],
    notesSummary: {
      chiefComplaint: "Hypoglycemia — Type 1 diabetic, blood glucose 31 mg/dL",
      vitals: "BG 31 on home glucometer; diaphoretic, tremulous, AMS improving after juice",
      patientHistory: "Type 1 Diabetes, Hypothyroidism",
      currentMedications: "Insulin Glargine 20 units daily, Levothyroxine 75mcg",
      allergies: "None known",
      callerRelationship: "Husband called on behalf of patient",
      keyObservations: "Insulin taken AM, missed lunch. Oral glucose given by family 5 min prior to call. Patient improving but incomplete response — D50 likely needed.",
      priority: "MED — Monitor for rebound hypoglycemia. Check glucose on arrival.",
    },
  },
  {
    id: "overdose",
    name: "Tyler Brennan",
    age: 28, sex: "M", dob: "11/02/1995",
    patientId: "PT-20240105",
    phone: "(415) 555-0537",
    address: "166 Turk St, San Francisco CA 94102",
    email: "",
    language: "English",
    risk: "HIGH",
    chiefComplaint: "Suspected Overdose",
    conditions: ["Opioid Use Disorder"],
    medications: ["Suboxone 8mg/2mg (prescribed, not currently taking)"],
    allergies: ["Naltrexone"],
    avatar: "TB",
    avatarBg: "bg-red-700",
    emergencyContact: { name: "Colleen Brennan", relationship: "Mother", phone: "(707) 555-0549" },
    isUnknownPatient: false,
    transcriptLines: [
      { speaker: "Dispatcher", text: "911, what is your emergency?" },
      { speaker: "Caller", text: "My friend is not breathing right. We were hanging out and he just went out. He was using — I don't know what he took." },
      { speaker: "Dispatcher", text: "What is your address?" },
      { speaker: "Caller", text: "166 Turk Street in the Tenderloin. Room 4 on the ground floor." },
      { speaker: "Dispatcher", text: "Is he breathing at all?" },
      { speaker: "Caller", text: "Barely. Like really slow. His lips are turning blue." },
      { speaker: "Dispatcher", text: "Does anyone there have Narcan?" },
      { speaker: "Caller", text: "Yeah — yes, I have a kit. Should I use it?" },
      { speaker: "Dispatcher", text: "Yes. Give one spray in one nostril now. Then tell me what happens." },
      { speaker: "Caller", text: "Okay — okay I did it. He's not waking up yet." },
      { speaker: "Dispatcher", text: "Give a second dose in the other nostril and perform rescue breathing if you know how. What is his name and age?" },
      { speaker: "Caller", text: "Tyler, he's 28. He had a Suboxone prescription but stopped taking it. He's allergic to Naltrexone." },
      { speaker: "Dispatcher", text: "EMS is 3 minutes out. Keep giving rescue breaths and stay on the line." },
      { speaker: "Caller", text: "He's making a noise — I think he's trying to breathe more. Come fast please." },
    ],
    notesSummary: {
      chiefComplaint: "Suspected opioid overdose — agonal breathing, cyanosis of lips",
      vitals: "Respirations severely depressed; cyanosis noted; partial Narcan response prior to arrival",
      patientHistory: "Opioid Use Disorder; Suboxone prescribed but not currently taking",
      currentMedications: "Suboxone 8mg/2mg (prescribed, non-compliant)",
      allergies: "Naltrexone — do not administer",
      callerRelationship: "Friend present at scene",
      keyObservations: "2 doses Narcan administered by bystander prior to EMS. Partial response. Fentanyl contamination possible — multiple Narcan doses may be needed. Contact mother (Colleen Brennan) for history.",
      priority: "HIGH — Airway priority. Prepare for Narcan repeat dosing. Overdose protocol.",
    },
  },
  {
    id: "fall",
    name: "Margaret Hollis",
    age: 82, sex: "F", dob: "06/30/1942",
    patientId: "PT-20240106",
    phone: "(510) 555-0614",
    address: "3320 Grand Ave, Oakland CA 94610",
    email: "m.hollis@comcast.net",
    language: "English",
    risk: "MED",
    chiefComplaint: "Elderly Fall",
    conditions: ["Osteoporosis", "Atrial Fibrillation", "Mild Cognitive Impairment"],
    medications: ["Apixaban 5mg", "Alendronate 70mg weekly", "Donepezil 5mg"],
    allergies: ["Codeine"],
    avatar: "MH",
    avatarBg: "bg-amber-600",
    emergencyContact: { name: "Patricia Hollis-Grant", relationship: "Daughter", phone: "(510) 555-0622" },
    isUnknownPatient: false,
    transcriptLines: [
      { speaker: "Dispatcher", text: "911, what is your emergency?" },
      { speaker: "Caller", text: "I think I've fallen. I'm on the floor. I can't get up and my hip hurts terribly." },
      { speaker: "Dispatcher", text: "Ma'am, stay calm. What is your address?" },
      { speaker: "Caller", text: "3320 Grand Avenue, Oakland. I live alone." },
      { speaker: "Dispatcher", text: "How did you fall? Did you hit your head?" },
      { speaker: "Caller", text: "I was going to the bathroom and my foot caught on the rug. I don't think I hit my head. Just my side and hip." },
      { speaker: "Dispatcher", text: "Do not try to get up on your own. Is there anyone in the house who can let paramedics in?" },
      { speaker: "Caller", text: "No, I'm alone. The front door is locked. My daughter has a key." },
      { speaker: "Dispatcher", text: "Do you have a medical alert device or can you reach the front door?" },
      { speaker: "Caller", text: "I have a medical alert but I already pressed it and it didn't connect. I can't reach the door from here." },
      { speaker: "Dispatcher", text: "Do you take any blood thinners? Any medical conditions?" },
      { speaker: "Caller", text: "Apixaban — yes, for my heart. And I have osteoporosis. I'm allergic to Codeine." },
      { speaker: "Dispatcher", text: "Paramedics are 5 minutes out. They will gain entry. Do not move. Keep talking to me." },
    ],
    notesSummary: {
      chiefComplaint: "Elderly fall — suspected right hip fracture, patient on floor, unable to rise",
      vitals: "Not obtained; patient conscious and communicating, no head strike reported",
      patientHistory: "Osteoporosis, Atrial Fibrillation, Mild Cognitive Impairment",
      currentMedications: "Apixaban 5mg (anticoagulant — bleeding risk), Alendronate 70mg weekly, Donepezil 5mg",
      allergies: "Codeine",
      callerRelationship: "Patient calling herself",
      keyObservations: "82F alone at home, door locked — forced entry likely required. On Apixaban — high bleeding risk with any fracture. Hip fracture suspected. Cognitive impairment may affect history accuracy.",
      priority: "MED — Hip fracture protocol. Alert ED to anticoagulation status.",
    },
  },
  {
    id: "resp",
    name: "George Tran",
    age: 67, sex: "M", dob: "09/14/1957",
    patientId: "PT-20240107",
    phone: "(415) 555-0733",
    address: "720 Ulloa St, San Francisco CA 94127",
    email: "g.tran@gmail.com",
    language: "English/Vietnamese",
    risk: "LOW",
    chiefComplaint: "Acute Respiratory Distress",
    conditions: ["COPD", "Congestive Heart Failure", "Former Smoker"],
    medications: ["Furosemide 40mg", "Albuterol inhaler", "Tiotropium", "Carvedilol 6.25mg"],
    allergies: ["Aspirin", "NSAIDs"],
    avatar: "GT",
    avatarBg: "bg-purple-600",
    emergencyContact: { name: "Linda Tran", relationship: "Wife", phone: "(415) 555-0741" },
    isUnknownPatient: false,
    transcriptLines: [
      { speaker: "Dispatcher", text: "911, what is your emergency?" },
      { speaker: "Caller", text: "My husband can barely breathe. He's been getting worse for two hours and now he can't even talk without stopping." },
      { speaker: "Dispatcher", text: "What is your address?" },
      { speaker: "Caller", text: "720 Ulloa Street in San Francisco, 94127." },
      { speaker: "Dispatcher", text: "Is he conscious and breathing?" },
      { speaker: "Caller", text: "Yes — awake, but he's leaning forward on the table trying to breathe. His lips look a little blue." },
      { speaker: "Dispatcher", text: "Does he use an inhaler? Has he already used it?" },
      { speaker: "Caller", text: "Yes, Albuterol — he used it twice. It's not helping. He also takes Tiotropium every morning." },
      { speaker: "Dispatcher", text: "Does he have any heart conditions as well?" },
      { speaker: "Caller", text: "Yes, congestive heart failure and COPD. He takes Furosemide and Carvedilol. He's allergic to Aspirin and all NSAIDs." },
      { speaker: "Dispatcher", text: "Keep him sitting upright — do not have him lie flat. Do not give him anything else. EMS is 6 minutes out." },
      { speaker: "Caller", text: "Okay, he's sitting up. His neck muscles are moving when he breathes — is that bad?" },
      { speaker: "Dispatcher", text: "That tells us he's working hard. Stay with him. Paramedics are coming now. Unlock the front door." },
    ],
    notesSummary: {
      chiefComplaint: "Acute respiratory distress — progressive dyspnea x2 hours, accessory muscle use, perioral cyanosis",
      vitals: "SpO2 not measured at home; tripod position, accessory muscle use confirmed by wife",
      patientHistory: "COPD, Congestive Heart Failure, Former Smoker",
      currentMedications: "Furosemide 40mg, Albuterol inhaler (x2 doses prior, ineffective), Tiotropium, Carvedilol 6.25mg",
      allergies: "Aspirin, NSAIDs — avoid",
      callerRelationship: "Wife called on behalf of patient",
      keyObservations: "Possible acute CHF exacerbation vs COPD exacerbation. Sitting upright. Albuterol ineffective. BiPAP may be needed. Do not give Aspirin or NSAIDs.",
      priority: "LOW — Monitor for rapid deterioration. CPAP/BiPAP ready.",
    },
  },
  {
    id: "pediatric",
    name: "Sofia Reyes",
    age: 6, sex: "F", dob: "02/20/2018",
    patientId: "PT-20240108",
    phone: "(925) 555-0822",
    address: "1455 Willow Pass Rd, Concord CA 94520",
    email: "",
    language: "English/Spanish",
    risk: "LOW",
    chiefComplaint: "Pediatric Emergency",
    conditions: ["Asthma"],
    medications: ["Albuterol inhaler PRN", "Fluticasone 44mcg daily"],
    allergies: ["Amoxicillin"],
    avatar: "SR",
    avatarBg: "bg-pink-500",
    emergencyContact: { name: "Carmen Reyes", relationship: "Mother", phone: "(925) 555-0822" },
    isUnknownPatient: false,
    transcriptLines: [
      { speaker: "Dispatcher", text: "911, what is your emergency?" },
      { speaker: "Caller", text: "My daughter — she's 6, she has asthma and she's having a really bad attack. Her inhaler isn't working." },
      { speaker: "Dispatcher", text: "What is your address?" },
      { speaker: "Caller", text: "1455 Willow Pass Road, Concord, 94520." },
      { speaker: "Dispatcher", text: "Is she breathing? Can she talk or cry?" },
      { speaker: "Caller", text: "She's breathing but it's like a whistling sound every breath. She's really scared. She can say a few words but can't finish sentences." },
      { speaker: "Dispatcher", text: "How many times did you use the inhaler?" },
      { speaker: "Caller", text: "Twice with the spacer, about 10 minutes ago. The doctor said to call 911 if it doesn't work." },
      { speaker: "Dispatcher", text: "You did the right thing. Is she sitting upright?" },
      { speaker: "Caller", text: "Yes, she's sitting on my lap. She seems more tired now, less fighting. Is that bad?" },
      { speaker: "Dispatcher", text: "It could mean she is tiring — this is important information for paramedics. Does she have any allergies?" },
      { speaker: "Caller", text: "Amoxicillin. She also takes Fluticasone every day." },
      { speaker: "Dispatcher", text: "EMS is 4 minutes away. Keep her sitting up, keep her calm, and do not give any more medication right now." },
      { speaker: "Caller", text: "Okay. Please hurry, she looks so pale." },
    ],
    notesSummary: {
      chiefComplaint: "Pediatric asthma exacerbation — status asthmaticus, Albuterol x2 with spacer ineffective",
      vitals: "Not obtained; audible wheeze, decreased air entry suspected, fatigue noted — possible respiratory failure",
      patientHistory: "Asthma (known)",
      currentMedications: "Albuterol inhaler PRN (x2 today, ineffective), Fluticasone 44mcg daily",
      allergies: "Amoxicillin",
      callerRelationship: "Mother calling on behalf of child patient",
      keyObservations: "6-year-old female. Worsening fatigue mid-call — sign of tiring respiratory muscles. Pediatric respiratory protocol. Consider early nebulized Albuterol + Ipratropium, Mag sulfate if severe. Ambu bag standby.",
      priority: "LOW — Escalate immediately if further fatigue. Pediatric team alert.",
    },
  },
  {
    id: "unresponsive-unknown",
    name: "Unknown Male, approx 50s",
    age: null, sex: "M", dob: "",
    patientId: "",
    phone: "",
    address: "Under BART overpass, 16th St & Mission St, San Francisco CA 94103",
    email: "",
    language: "Unknown",
    risk: "UNKNOWN",
    chiefComplaint: "Unresponsive - Unknown Cause",
    conditions: [],
    medications: [],
    allergies: [],
    avatar: "??",
    avatarBg: "bg-gray-500",
    emergencyContact: null,
    isUnknownPatient: true,
    note: "No identification found. Caller is a Good Samaritan with no prior knowledge of patient. No medical history, medications, or allergies available.",
    transcriptLines: [
      { speaker: "Dispatcher", text: "911, what is your emergency?" },
      { speaker: "Caller", text: "There's a man under the BART overpass at 16th and Mission and he's completely unresponsive. I can't wake him up." },
      { speaker: "Dispatcher", text: "What is the exact address?" },
      { speaker: "Caller", text: "16th Street and Mission Street, under the elevated tracks, south side." },
      { speaker: "Dispatcher", text: "Is he breathing?" },
      { speaker: "Caller", text: "I think so — his chest is moving a little but very slowly. He doesn't respond when I shake him or yell." },
      { speaker: "Dispatcher", text: "Do you see any injuries, bottles, or drug paraphernalia nearby?" },
      { speaker: "Caller", text: "There are some bags around him. I see what looks like a syringe on the ground nearby. I don't want to touch anything." },
      { speaker: "Dispatcher", text: "That's okay. Do not touch any paraphernalia. Do you know this person at all?" },
      { speaker: "Caller", text: "No, I was just walking by. I have no idea who he is. He looks like maybe 50s, African American, wearing a grey hoodie." },
      { speaker: "Dispatcher", text: "Does he have any ID visible on him?" },
      { speaker: "Caller", text: "I can see he has a backpack. I'm not comfortable going through it. There's nothing else I can see." },
      { speaker: "Dispatcher", text: "EMS and PD are being dispatched now. Stay nearby but at a safe distance. ETA approximately 5 minutes." },
      { speaker: "Caller", text: "Okay. He just made a sound — kind of a gurgling. I don't think he's doing well." },
    ],
    notesSummary: {
      chiefComplaint: "Unresponsive male found under BART overpass — suspected opioid overdose based on scene",
      vitals: "Agonal breathing reported by bystander; GCS unknown — unresponsive to voice and physical stimulus",
      patientHistory: "Unknown — no ID found",
      currentMedications: "Unknown",
      allergies: "Unknown — use caution with all medications",
      callerRelationship: "Good Samaritan bystander, no prior relationship",
      keyObservations: "Syringe found at scene. Gurgling sound reported — aspiration risk. Unknown male approx 50s. No ID. PD co-response for ID and scene safety. Narcan empirically.",
      priority: "UNKNOWN — Treat as opioid OD until proven otherwise. Airway priority.",
    },
  },
  {
    id: "good-samaritan",
    name: "Unknown Female, approx 30s",
    age: null, sex: "F", dob: "",
    patientId: "",
    phone: "",
    address: "Near Caltrain Station, 700 4th St, San Francisco CA 94107",
    email: "",
    language: "Unknown",
    risk: "UNKNOWN",
    chiefComplaint: "Good Samaritan - Unidentified Person",
    conditions: [],
    medications: [],
    allergies: [],
    avatar: "??",
    avatarBg: "bg-gray-400",
    emergencyContact: null,
    isUnknownPatient: true,
    note: "Caller found patient collapsed outside Caltrain station. No identification on patient. Unknown medical history. Good Samaritan caller with no prior knowledge of patient.",
    transcriptLines: [
      { speaker: "Dispatcher", text: "911, what is your emergency?" },
      { speaker: "Caller", text: "A woman just collapsed right in front of me outside the Caltrain station. She was walking and then just dropped. She's on the ground." },
      { speaker: "Dispatcher", text: "What is the address?" },
      { speaker: "Caller", text: "700 4th Street in San Francisco — right outside the main entrance of the 4th and King Caltrain station." },
      { speaker: "Dispatcher", text: "Is she conscious? Is she breathing?" },
      { speaker: "Caller", text: "She's not responding. I tapped her shoulder and called out to her. I can see her chest rising." },
      { speaker: "Dispatcher", text: "Are you trained in CPR?" },
      { speaker: "Caller", text: "Yes, I am. Do you want me to start?" },
      { speaker: "Dispatcher", text: "Check for a pulse first. Put two fingers on the side of her neck and tell me what you feel." },
      { speaker: "Caller", text: "I feel a pulse — it's fast but it's there. She's not in cardiac arrest." },
      { speaker: "Dispatcher", text: "Good. Do not start CPR then. Does she have any ID with her? A bag or wallet?" },
      { speaker: "Caller", text: "She has a small purse. I don't see a wallet — just keys and a phone but it's locked. No ID visible." },
      { speaker: "Dispatcher", text: "Paramedics are 3 minutes away. Place her in the recovery position — on her side if you can — and stay with her." },
      { speaker: "Caller", text: "Done. She's on her side now. There are a few other people around, I'll make sure someone flags down the ambulance." },
    ],
    notesSummary: {
      chiefComplaint: "Witnessed syncopal collapse outside Caltrain station — unknown cause",
      vitals: "Pulse present (fast); breathing present; unresponsive to verbal/physical stimulus",
      patientHistory: "Unknown — no ID found",
      currentMedications: "Unknown",
      allergies: "Unknown — use caution with all medications",
      callerRelationship: "Good Samaritan bystander, CPR trained, no prior relationship",
      keyObservations: "Witnessed collapse, non-traumatic fall. Pulse present and breathing. Recovery position by bystander. Phone locked — no ID. Consider cardiac arrhythmia, seizure, or syncope. Unknown female approx 30s.",
      priority: "UNKNOWN — Full workup required. 12-lead on arrival.",
    },
  },
];

type EncounterResult = {
  id: string; status: string; acuity: string;
  chiefComplaint?: string; diagnosis?: string; confidence?: number;
  safetyFlags: number; orders: number; auditEntries: number;
};

export default function NineOneOne() {
  const [scenarios, setScenarios] = useState<Patient[]>(INITIAL_PATIENTS);
  const [selected, setSelected] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EncounterResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"Timeline" | "Notes">("Timeline");
  const [ecFormOpen, setEcFormOpen] = useState(false);
  const [ecForm, setEcForm] = useState({ name: "", relationship: "", phone: "" });
  const [contactFormOpen, setContactFormOpen] = useState(false);
  const [contactForm, setContactForm] = useState({ name: "", dob: "", phone: "", address: "", patientId: "" });

  const launchScenario = async (scenario: Patient) => {
    setSelected(scenario);
    setLoading(true);
    setError(null);
    setResult(null);
    setActiveTab("Timeline");
    setEcFormOpen(false);
    setContactFormOpen(false);
    try {
      const transcriptText = scenario.transcriptLines.map(l => l.speaker + ": " + l.text).join("\n");
      const res = await fetch(`${API_URL}/api/agents/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer paramedic_sarah" },
        body: JSON.stringify({ transcript: transcriptText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const e = data.encounter;
      setResult({
        id: e.id, status: e.status, acuity: e.acuity,
        chiefComplaint: e.structuredData?.chiefComplaint,
        diagnosis: e.diagnosis?.primary,
        confidence: e.diagnosis?.confidence,
        safetyFlags: e.safetyFlags?.length ?? 0,
        orders: e.draftOrders?.length ?? 0,
        auditEntries: e.auditTrail?.length ?? 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pipeline failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPatient = (s: Patient) => {
    const fresh = scenarios.find(p => p.id === s.id) ?? s;
    setSelected(fresh);
    setLoading(false);
    setResult(null);
    setError(null);
    setActiveTab("Timeline");
    setEcFormOpen(false);
    setContactFormOpen(false);
  };

  const submitEcForm = () => {
    if (!selected) return;
    const updated = scenarios.map(p =>
      p.id === selected.id ? { ...p, emergencyContact: { name: ecForm.name, relationship: ecForm.relationship, phone: ecForm.phone } } : p
    );
    setScenarios(updated);
    setSelected({ ...selected, emergencyContact: { name: ecForm.name, relationship: ecForm.relationship, phone: ecForm.phone } });
    setEcForm({ name: "", relationship: "", phone: "" });
    setEcFormOpen(false);
  };

  const submitContactForm = () => {
    if (!selected) return;
    const updated = scenarios.map(p =>
      p.id === selected.id ? { ...p, name: contactForm.name || p.name, dob: contactForm.dob || p.dob, phone: contactForm.phone || p.phone, address: contactForm.address || p.address, patientId: contactForm.patientId || p.patientId, isUnknownPatient: false } : p
    );
    setScenarios(updated);
    setSelected({ ...selected, name: contactForm.name || selected.name, dob: contactForm.dob || selected.dob, phone: contactForm.phone || selected.phone, address: contactForm.address || selected.address, patientId: contactForm.patientId || selected.patientId, isUnknownPatient: false });
    setContactForm({ name: "", dob: "", phone: "", address: "", patientId: "" });
    setContactFormOpen(false);
  };

  const riskBadgeList = (risk: string) =>
    risk === "HIGH" ? "bg-red-100 text-red-700" :
    risk === "MED" ? "bg-orange-100 text-orange-700" :
    risk === "LOW" ? "bg-green-100 text-green-700" :
    "bg-gray-100 text-gray-500";

  const riskBadgeHeader = (risk: string) =>
    risk === "HIGH" ? "bg-red-500" :
    risk === "MED" ? "bg-orange-500" :
    risk === "LOW" ? "bg-green-500" :
    "bg-gray-400";

  const NURSE_URL = process.env.NEXT_PUBLIC_NURSE_URL ?? "https://nurse-seven.vercel.app";
  const DOCTOR_URL = process.env.NEXT_PUBLIC_DOCTOR_CRM_URL ?? "https://guestflow-doctor.vercel.app/crm";

  const inputCls = "w-full border border-gray-200 rounded px-2 py-1 text-xs text-gray-800 focus:outline-none focus:border-[#2563a8] mt-0.5";

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      {/* Top Nav */}
      <nav className="bg-[#1e3f7a] text-white flex items-center h-10 px-3 gap-3 flex-shrink-0">
        <div className="grid grid-cols-3 gap-0.5 w-5 h-5 flex-shrink-0">
          {Array.from({length:9}).map((_,i)=><div key={i} className="w-1.5 h-1.5 bg-white rounded-sm opacity-80"/>)}
        </div>
        <div className="flex items-center gap-1 text-sm">
          <span className="opacity-70">HealthFlow</span>
          <span className="opacity-40 mx-1">›</span>
          <span className="opacity-70">Emergency</span>
          <span className="opacity-40 mx-1">›</span>
          <span className="font-semibold">911 Dispatch</span>
        </div>
        <div className="ml-auto flex items-center gap-3 text-sm opacity-80">
          <span>Search</span><span>History</span><span>Settings</span>
          <div className="w-7 h-7 rounded-full bg-orange-500 flex items-center justify-center text-xs font-bold">D</div>
        </div>
      </nav>

      {/* Action Bar */}
      <div className="bg-[#2563a8] text-white flex items-center h-9 px-4 gap-1 flex-shrink-0">
        {["Zoom In","Zoom Out"].map(btn=>(
          <button key={btn} className="flex items-center gap-1.5 text-xs font-medium px-3 h-7 rounded border border-white/20 hover:bg-white/10 transition-colors">
            {btn}
          </button>
        ))}
        <div className="ml-auto text-xs opacity-70">
          Dispatcher: Sarah Mitchell · Unit 42 · {new Date().toLocaleTimeString()}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden p-3 gap-3">
        {/* Left: Patient Selector */}
        <div className="w-72 flex-shrink-0 flex flex-col gap-2">
          <div className="bg-white border border-gray-200 rounded">
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
              <span className="text-[#00a99d] font-semibold text-xs tracking-wide uppercase">Active Patients</span>
              <span className="text-gray-400 text-xs">{scenarios.length} records</span>
            </div>
            <div className="divide-y divide-gray-100">
              {scenarios.map(s => (
                <button
                  key={s.id}
                  onClick={() => handleSelectPatient(s)}
                  className={`w-full text-left px-3 py-2.5 hover:bg-blue-50 transition-colors flex items-center gap-2.5 ${selected?.id === s.id ? "bg-blue-50 border-l-2 border-l-[#2563a8]" : ""}`}
                >
                  <div className={`w-8 h-8 rounded-full ${s.avatarBg} text-white flex items-center justify-center text-xs font-bold flex-shrink-0`}>{s.avatar}</div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 text-xs truncate">{s.name}</p>
                    <p className="text-gray-500 text-xs truncate">{s.age !== null ? `${s.age}yo` : "Unknown"} · {s.chiefComplaint}</p>
                  </div>
                  <span className={`ml-auto text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${riskBadgeList(s.risk)}`}>{s.risk}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Center: Patient Detail */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          {selected ? (
            <>
              {/* Patient header card */}
              <div className="bg-white border border-gray-200 rounded p-4">
                <div className="flex items-start gap-4">
                  <div className={`w-16 h-16 rounded-full ${selected.avatarBg} text-white flex items-center justify-center text-xl font-bold flex-shrink-0`}>
                    {selected.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-400 uppercase tracking-wide">PATIENT</p>
                    <h1 className="text-2xl font-bold text-gray-900">{selected.name}</h1>
                    <p className="text-sm text-gray-500 mt-0.5">{selected.chiefComplaint}</p>
                    {selected.note && (
                      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-1">{selected.note}</p>
                    )}
                  </div>
                  <div className="flex gap-6 text-sm flex-shrink-0">
                    <div><p className="text-gray-400 text-xs">Language</p><p className="font-medium">{selected.language}</p></div>
                    <div><p className="text-gray-400 text-xs">Risk Level</p>
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold text-white ${riskBadgeHeader(selected.risk)}`}>{selected.risk}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Two column detail */}
              <div className="flex gap-3 flex-1">
                {/* Contact Info */}
                <div className="w-56 flex-shrink-0">
                  <div className="bg-white border border-gray-200 rounded h-full overflow-y-auto">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
                      <span className="text-[#00a99d] font-semibold text-xs uppercase tracking-wide">Contact Info</span>
                      {selected.isUnknownPatient && (
                        <button onClick={() => { setContactFormOpen(v => !v); setEcFormOpen(false); }} className="text-[#2563a8] text-lg leading-none">+</button>
                      )}
                    </div>

                    {/* Inline contact form for unknown patients */}
                    {contactFormOpen && selected.isUnknownPatient && (
                      <div className="px-3 py-2 bg-blue-50 border-b border-blue-100">
                        <p className="text-[#2563a8] font-semibold text-xs mb-2">Add Patient Info</p>
                        {[
                          { label: "Full Name", key: "name" as const },
                          { label: "Date of Birth", key: "dob" as const },
                          { label: "Phone", key: "phone" as const },
                          { label: "Address", key: "address" as const },
                          { label: "Patient ID", key: "patientId" as const },
                        ].map(({ label, key }) => (
                          <div key={key} className="mb-1.5">
                            <p className="text-gray-500 text-xs">{label}</p>
                            <input className={inputCls} value={contactForm[key]} onChange={e => setContactForm(f => ({ ...f, [key]: e.target.value }))} />
                          </div>
                        ))}
                        <div className="flex gap-1.5 mt-2">
                          <button onClick={submitContactForm} className="flex-1 py-1 bg-[#2563a8] text-white text-xs rounded font-semibold">Save</button>
                          <button onClick={() => setContactFormOpen(false)} className="flex-1 py-1 border border-gray-200 text-gray-600 text-xs rounded">Cancel</button>
                        </div>
                      </div>
                    )}

                    <div className="px-3 py-2 space-y-2 text-xs">
                      {[
                        ["Full Name", selected.name],
                        ["Patient ID", selected.patientId || "—"],
                        ["Cell Phone", selected.phone || "—"],
                        ["Address", selected.address || "—"],
                        ["Email", selected.email || "—"],
                        ["Date of Birth", selected.dob ? `${selected.dob}${selected.age !== null ? ` (${selected.age})` : ""}` : "—"],
                        ["Sex", selected.sex === "M" ? "Male" : selected.sex === "F" ? "Female" : "Unknown"],
                      ].map(([label, val]) => (
                        <div key={label}>
                          <p className="text-gray-400">{label}</p>
                          <p className="text-gray-800 font-medium break-words">{val}</p>
                        </div>
                      ))}
                    </div>

                    {/* Medical History */}
                    <div className="border-t border-gray-100 px-3 py-2">
                      <p className="text-[#00a99d] font-semibold text-xs uppercase tracking-wide mb-2">Medical History</p>
                      {selected.conditions.length > 0 ? selected.conditions.map(c=>(
                        <div key={c} className="text-xs text-gray-700 flex items-center gap-1 mb-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0"/>
                          {c}
                        </div>
                      )) : <p className="text-xs text-gray-400 italic">No prior conditions</p>}
                    </div>

                    {/* Emergency Contact */}
                    <div className="border-t border-gray-100 px-3 py-2">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[#00a99d] font-semibold text-xs uppercase tracking-wide">Emergency Contact</p>
                        {!selected.emergencyContact && (
                          <button onClick={() => { setEcFormOpen(v => !v); setContactFormOpen(false); }} className="text-[#2563a8] text-lg leading-none">+</button>
                        )}
                      </div>

                      {selected.emergencyContact ? (
                        <div className="space-y-1">
                          <div><p className="text-gray-400 text-xs">Name</p><p className="text-gray-800 font-medium text-xs">{selected.emergencyContact.name}</p></div>
                          <div><p className="text-gray-400 text-xs">Relationship</p><p className="text-gray-800 font-medium text-xs">{selected.emergencyContact.relationship}</p></div>
                          <div><p className="text-gray-400 text-xs">Phone</p><p className="text-gray-800 font-medium text-xs">{selected.emergencyContact.phone}</p></div>
                        </div>
                      ) : (
                        <>
                          {!ecFormOpen && <p className="text-xs text-gray-400 italic">Not on file</p>}
                          {ecFormOpen && (
                            <div className="bg-blue-50 rounded p-2 border border-blue-100">
                              {[
                                { label: "Name", key: "name" as const },
                                { label: "Relationship", key: "relationship" as const },
                                { label: "Phone", key: "phone" as const },
                              ].map(({ label, key }) => (
                                <div key={key} className="mb-1.5">
                                  <p className="text-gray-500 text-xs">{label}</p>
                                  <input className={inputCls} value={ecForm[key]} onChange={e => setEcForm(f => ({ ...f, [key]: e.target.value }))} />
                                </div>
                              ))}
                              <div className="flex gap-1.5 mt-2">
                                <button onClick={submitEcForm} className="flex-1 py-1 bg-[#2563a8] text-white text-xs rounded font-semibold">Save</button>
                                <button onClick={() => setEcFormOpen(false)} className="flex-1 py-1 border border-gray-200 text-gray-600 text-xs rounded">Cancel</button>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Field Transcript */}
                <div className="flex-1 min-w-0">
                  <div className="bg-white border border-gray-200 rounded h-full flex flex-col">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
                      <span className="text-[#00a99d] font-semibold text-xs uppercase tracking-wide">Field Transcript</span>
                      <div className="flex gap-2">
                        {(["Timeline","Notes"] as const).map(t=>(
                          <button
                            key={t}
                            onClick={() => setActiveTab(t)}
                            className={`text-xs pb-0.5 transition-colors ${activeTab === t ? "text-[#2563a8] font-semibold border-b border-[#2563a8]" : "text-gray-500 hover:text-gray-700"}`}
                          >{t}</button>
                        ))}
                      </div>
                    </div>
                    <div className="p-3 flex-1 overflow-y-auto">
                      {activeTab === "Timeline" ? (
                        <div className="mb-3">
                          {selected.transcriptLines.map((line, i) => (
                            <div key={i} className={`flex gap-2 mb-2 ${line.speaker === "Caller" ? "flex-row-reverse" : ""}`}>
                              <span className={`text-xs font-semibold flex-shrink-0 w-20 pt-1 ${line.speaker === "Dispatcher" ? "text-[#2563a8]" : "text-gray-500 text-right"}`}>
                                {line.speaker}
                              </span>
                              <p className="text-xs text-gray-700 bg-gray-50 rounded px-2 py-1.5 border border-gray-100 flex-1 leading-relaxed">{line.text}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mb-3 space-y-2">
                          {(Object.entries(selected.notesSummary) as [string, string | undefined][]).map(([key, val]) => val ? (
                            <div key={key}>
                              <p className="text-gray-400 text-xs capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</p>
                              <p className="text-gray-800 font-medium text-xs leading-relaxed">{val}</p>
                            </div>
                          ) : null)}
                        </div>
                      )}

                      {/* Medications + Allergies */}
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Current Medications</p>
                          {selected.medications.length > 0 ? selected.medications.map(m=>(
                            <div key={m} className="text-xs text-gray-700 flex items-center gap-1 mb-0.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-purple-400"/>
                              {m}
                            </div>
                          )) : <p className="text-xs text-gray-400 italic">None known</p>}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Allergies</p>
                          {selected.allergies.length > 0 ? selected.allergies.map(a=>(
                            <div key={a} className="text-xs text-red-700 flex items-center gap-1 mb-0.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-400"/>
                              {a}
                            </div>
                          )) : <p className="text-xs text-gray-400 italic">None known</p>}
                        </div>
                      </div>

                      <button
                        onClick={() => launchScenario(selected)}
                        disabled={loading}
                        className="w-full py-2.5 bg-[#2563a8] hover:bg-[#1e3f7a] text-white text-sm font-semibold rounded transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {loading ? (
                          <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Running Pipeline...</>
                        ) : "Launch Emergency Pipeline"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right: Pipeline Result */}
                <div className="w-56 flex-shrink-0 space-y-3">
                  <div className="bg-white border border-gray-200 rounded">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
                      <span className="text-[#00a99d] font-semibold text-xs uppercase tracking-wide">Pipeline Status</span>
                    </div>
                    {result ? (
                      <div className="px-3 py-2 space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Status</span>
                          <span className="font-medium text-blue-700 capitalize">{result.status.replace(/_/g," ")}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Acuity</span>
                          <span className={`font-bold uppercase px-1.5 py-0.5 rounded text-xs ${
                            result.acuity === "critical" ? "bg-red-100 text-red-700" :
                            result.acuity === "high" ? "bg-orange-100 text-orange-700" : "bg-yellow-100 text-yellow-700"
                          }`}>{result.acuity}</span>
                        </div>
                        <div className="flex justify-between"><span className="text-gray-400">Orders</span><span className="font-medium">{result.orders}</span></div>
                        <div className="flex justify-between"><span className="text-gray-400">Safety Flags</span>
                          <span className={`font-bold ${result.safetyFlags > 0 ? "text-red-600" : "text-gray-700"}`}>{result.safetyFlags}</span>
                        </div>
                        <div className="flex justify-between"><span className="text-gray-400">Audit Entries</span><span className="font-medium">{result.auditEntries}</span></div>
                        {result.confidence && (
                          <div>
                            <div className="flex justify-between mb-0.5"><span className="text-gray-400">Dx Confidence</span><span className="font-medium">{(result.confidence*100).toFixed(0)}%</span></div>
                            <div className="h-1 bg-gray-200 rounded-full"><div className="h-1 bg-blue-500 rounded-full" style={{width:`${result.confidence*100}%`}}/></div>
                          </div>
                        )}
                        {result.diagnosis && <div><p className="text-gray-400">Diagnosis</p><p className="font-medium text-gray-800 text-xs">{result.diagnosis}</p></div>}
                      </div>
                    ) : loading ? (
                      <div className="px-3 py-6 text-center text-xs text-gray-400">
                        <svg className="animate-spin h-5 w-5 mx-auto mb-2 text-blue-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                        Running agents...
                      </div>
                    ) : (
                      <div className="px-3 py-4 text-center text-xs text-gray-400 italic">Click Launch to run pipeline</div>
                    )}
                  </div>

                  {result && (
                    <div className="bg-white border border-gray-200 rounded">
                      <div className="px-3 py-2 border-b border-gray-100">
                        <span className="text-[#00a99d] font-semibold text-xs uppercase tracking-wide">Continue To</span>
                      </div>
                      <div className="px-3 py-2 space-y-2">
                        <a href={NURSE_URL} target="_blank" rel="noopener noreferrer"
                          className="block w-full text-center py-2 text-xs font-semibold bg-teal-600 text-white rounded hover:bg-teal-700 transition-colors">
                          Nurse Station
                        </a>
                        <a href={DOCTOR_URL} target="_blank" rel="noopener noreferrer"
                          className="block w-full text-center py-2 text-xs font-semibold bg-[#2563a8] text-white rounded hover:bg-[#1e3f7a] transition-colors">
                          Doctor CRM
                        </a>
                        <a href={`https://guestflow-paramedic.vercel.app`} target="_blank" rel="noopener noreferrer"
                          className="block w-full text-center py-2 text-xs font-semibold border border-gray-300 text-gray-600 rounded hover:bg-gray-50 transition-colors">
                          Paramedic View
                        </a>
                      </div>
                    </div>
                  )}

                  {error && (
                    <div className="bg-red-50 border border-red-200 rounded px-3 py-2">
                      <p className="text-xs text-red-700">{error}</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 bg-white border border-gray-200 rounded flex items-center justify-center">
              <div className="text-center">
                <p className="text-gray-400 font-medium">Select a patient scenario</p>
                <p className="text-gray-300 text-xs mt-1">Choose from the preset emergency cases on the left</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
