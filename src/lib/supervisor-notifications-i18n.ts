import { AppNotification } from "../types";
import { SupervisorLang } from "./supervisor-i18n";

type LocalizedText = { title: string; message: string };

function match(
  message: string,
  pattern: RegExp,
): Record<string, string> | null {
  const m = message.match(pattern);
  if (!m?.groups) return null;
  return m.groups as Record<string, string>;
}

function localizeCommitmentCreated(message: string, lang: SupervisorLang): string | null {
  const m = match(
    message,
    /^You committed to visit (?<school>.+?) \((?<block>.+?)\) from (?<range>.+?)\. Please visit the school and submit your field visit report within this period to fulfill your commitment\.$/,
  );
  if (!m) return null;
  if (lang === "hi") {
    return `आपने ${m.school} (${m.block}) की विज़िट ${m.range} के लिए कमिट की है। कृपया इस अवधि में स्कूल जाएं और अपनी फील्ड विज़िट रिपोर्ट जमा करके कमिटमेंट पूरी करें।`;
  }
  return message;
}

function localizeCommitmentOverdue(message: string, lang: SupervisorLang): string | null {
  const m = match(
    message,
    /^Your commitment to visit (?<school>.+?) \((?<block>.+?)\) for (?<range>.+?) is overdue\. Please visit the school immediately, complete the field visit, and submit your visit report to fulfill this commitment\.$/,
  );
  if (!m) return null;
  if (lang === "hi") {
    return `आपकी ${m.school} (${m.block}) की विज़िट ${m.range} के लिए कमिटमेंट अतिदेय है। कृपया तुरंत स्कूल जाएं, फील्ड विज़िट पूरी करें और रिपोर्ट जमा करें।`;
  }
  return message;
}

function localizeCommitmentReminder(
  title: string,
  message: string,
  lang: SupervisorLang,
): LocalizedText | null {
  if (lang !== "hi") return null;

  const patterns: Array<{
    title: string;
    pattern: RegExp;
    hiTitle: string;
    hiMessage: (g: Record<string, string>) => string;
  }> = [
    {
      title: "Commitment starts today",
      pattern:
        /^Your commitment to visit (?<school>.+?) \((?<block>.+?)\) starts today \((?<range>.+?)\)\. Please visit the school and submit your field visit report\.$/,
      hiTitle: "आज कमिटमेंट शुरू",
      hiMessage: (g) =>
        `आपकी ${g.school} (${g.block}) की विज़िट की कमिटमेंट आज (${g.range}) से शुरू है। कृपया स्कूल जाएं और फील्ड विज़िट रिपोर्ट जमा करें।`,
    },
    {
      title: "Commitment due today",
      pattern:
        /^Today is the last day of your commitment to visit (?<school>.+?) \((?<block>.+?)\) \((?<range>.+?)\)\. Please visit and submit your field visit report before the day ends\.$/,
      hiTitle: "आज अंतिम दिन",
      hiMessage: (g) =>
        `आज ${g.school} (${g.block}) की विज़िट कमिटमेंट (${g.range}) का अंतिम दिन है। कृपया दिन समाप्त होने से पहले विज़िट करें और रिपोर्ट जमा करें।`,
    },
    {
      title: "Commitment due tomorrow",
      pattern:
        /^Your commitment to visit (?<school>.+?) \((?<block>.+?)\) ends tomorrow \((?<range>.+?)\)\. Please visit the school and submit your field visit report\.$/,
      hiTitle: "कल अंतिम दिन",
      hiMessage: (g) =>
        `आपकी ${g.school} (${g.block}) की विज़िट कमिटमेंट कल (${g.range}) समाप्त होगी। कृपया स्कूल जाएं और फील्ड विज़िट रिपोर्ट जमा करें।`,
    },
    {
      title: "Complete your commitment",
      pattern:
        /^You still have an active commitment to visit (?<school>.+?) \((?<block>.+?)\) \((?<range>.+?)\)\. Please complete your visit and submit the field visit report\.$/,
      hiTitle: "कमिटमेंट पूरी करें",
      hiMessage: (g) =>
        `आपकी ${g.school} (${g.block}) की सक्रिय कमिटमेंट (${g.range}) अभी भी लंबित है। कृपया विज़िट पूरी करें और रिपोर्ट जमा करें।`,
    },
    {
      title: "Fulfill your commitment",
      pattern:
        /^Please visit (?<school>.+?) \((?<block>.+?)\) and submit your field visit report to fulfill your commitment for (?<range>.+?)\.$/,
      hiTitle: "अपनी कमिटमेंट पूरी करें",
      hiMessage: (g) =>
        `कृपया ${g.school} (${g.block}) जाएं और ${g.range} की कमिटमेंट पूरी करने के लिए फील्ड विज़िट रिपोर्ट जमा करें।`,
    },
  ];

  for (const entry of patterns) {
    if (title !== entry.title) continue;
    const groups = match(message, entry.pattern);
    if (!groups) continue;
    return { title: entry.hiTitle, message: entry.hiMessage(groups) };
  }
  return null;
}

function localizeCommitmentAdminUpdate(message: string, lang: SupervisorLang): string | null {
  const m = match(
    message,
    /^(?<who>.+?) updated your commitment for (?<school>.+?) to "(?<status>.+?)"\.(?: Admin note: (?<note>.+))?$/,
  );
  if (!m) return null;
  if (lang === "hi") {
    const statusMap: Record<string, string> = {
      Committed: "कमिटेड",
      "In Progress": "प्रगति में",
      Completed: "पूर्ण",
      Cancelled: "रद्द",
    };
    const status = statusMap[m.status] || m.status;
    const note = m.note ? ` एडमिन नोट: ${m.note}` : "";
    return `${m.who} ने ${m.school} की आपकी कमिटमेंट "${status}" में अपडेट की।${note}`;
  }
  return message;
}

function localizeVisitReviewed(
  title: string,
  message: string,
  lang: SupervisorLang,
): LocalizedText | null {
  const m = match(
    message,
    /^Your visit to (?<school>.+?) on (?<date>.+?) was (?<status>approved|rejected) by admin\.$/,
  );
  if (!m) return null;
  if (lang === "hi") {
    const status = m.status === "approved" ? "स्वीकृत" : "अस्वीकृत";
    return {
      title: m.status === "approved" ? "विज़िट स्वीकृत" : "विज़िट अस्वीकृत",
      message: `${m.date} को ${m.school} की आपकी विज़िट एडमिन द्वारा ${status} की गई।`,
    };
  }
  return { title, message };
}

function localizePlannedVisit(
  type: AppNotification["type"],
  message: string,
  lang: SupervisorLang,
): LocalizedText | null {
  if (lang !== "hi") return null;

  if (type === "planned_visit_due") {
    const m = match(
      message,
      /^You have a planned visit to (?<school>.+?) \((?<block>.+?)\) today\. Please submit your visit report\.$/,
    );
    if (!m) return null;
    return {
      title: "आज की योजना बनी विज़िट",
      message: `आज ${m.school} (${m.block}) की योजना बनी विज़िट है। कृपया अपनी विज़िट रिपोर्ट जमा करें।`,
    };
  }

  if (type === "planned_visit_missed") {
    const m = match(
      message,
      /^Your planned visit to (?<school>.+?) \((?<block>.+?)\) on (?<date>.+?) was not submitted\.$/,
    );
    if (!m) return null;
    return {
      title: "योजना बनी विज़िट छूटी",
      message: `${m.date} को ${m.school} (${m.block}) की योजना बनी विज़िट जमा नहीं की गई।`,
    };
  }

  return null;
}

function localizeRequestResponse(
  title: string,
  message: string,
  lang: SupervisorLang,
): LocalizedText | null {
  if (lang !== "hi") return null;

  if (title === "Admin responded to your request") {
    const m = match(message, /^(?<who>.+?): (?<body>.+)$/s);
    if (!m) return null;
    return {
      title: "एडमिन ने आपके अनुरोध का जवाब दिया",
      message: `${m.who}: ${m.body}`,
    };
  }

  if (title === "Request closed") {
    if (
      message ===
      "This request was closed automatically because no acknowledgment was received within 2 days of the admin response."
    ) {
      return {
        title: "अनुरोध बंद",
        message:
          "एडमिन के जवाब के 2 दिनों के भीतर कोई पुष्टि न मिलने पर यह अनुरोध स्वचालित रूप से बंद कर दिया गया।",
      };
    }
    const m = match(message, /^(?<who>.+?) closed this request\.$/);
    if (m) {
      return {
        title: "अनुरोध बंद",
        message: `${m.who} ने यह अनुरोध बंद किया।`,
      };
    }
  }

  if (title === "Super admin closed your escalated request") {
    const m = match(message, /^(?<who>.+?): (?<body>.+)$/s);
    if (!m) return null;
    return {
      title: "सुपर एडमिन ने एस्केलेटेड अनुरोध बंद किया",
      message: `${m.who}: ${m.body}`,
    };
  }

  if (title === "Super admin responded to your escalation") {
    const m = match(message, /^(?<who>.+?): (?<body>.+)$/s);
    if (!m) return null;
    return {
      title: "सुपर एडमिन ने एस्केलेशन का जवाब दिया",
      message: `${m.who}: ${m.body}`,
    };
  }

  return null;
}

const TITLE_HI: Partial<Record<AppNotification["type"], Record<string, string>>> = {
  commitment_created: { "Commitment recorded": "कमिटमेंट दर्ज" },
  commitment_overdue: { "URGENT: Commitment overdue": "जरूरी: कमिटमेंट अतिदेय" },
  commitment_admin_update: { "Admin updated your commitment": "एडमिन ने कमिटमेंट अपडेट की" },
  planned_visit_due: { "Planned visit today": "आज की योजना बनी विज़िट" },
  planned_visit_missed: { "Planned visit missed": "योजना बनी विज़िट छूटी" },
};

export function localizeSupervisorNotification(
  notif: Pick<AppNotification, "type" | "title" | "message">,
  lang: SupervisorLang,
): LocalizedText {
  if (lang === "en") {
    return { title: notif.title, message: notif.message };
  }

  let message = notif.message;
  let title = notif.title;

  switch (notif.type) {
    case "commitment_created": {
      const localized = localizeCommitmentCreated(message, lang);
      if (localized) message = localized;
      title = TITLE_HI.commitment_created?.[notif.title] || title;
      break;
    }
    case "commitment_overdue": {
      const localized = localizeCommitmentOverdue(message, lang);
      if (localized) message = localized;
      title = TITLE_HI.commitment_overdue?.[notif.title] || title;
      break;
    }
    case "commitment_reminder": {
      const localized = localizeCommitmentReminder(title, message, lang);
      if (localized) return localized;
      break;
    }
    case "commitment_admin_update": {
      const localized = localizeCommitmentAdminUpdate(message, lang);
      if (localized) message = localized;
      title = TITLE_HI.commitment_admin_update?.[notif.title] || title;
      break;
    }
    case "visit_reviewed": {
      const localized = localizeVisitReviewed(title, message, lang);
      if (localized) return localized;
      break;
    }
    case "planned_visit_due":
    case "planned_visit_missed": {
      const localized = localizePlannedVisit(notif.type, message, lang);
      if (localized) return localized;
      break;
    }
    case "supervisor_request_response": {
      const localized = localizeRequestResponse(title, message, lang);
      if (localized) return localized;
      break;
    }
    default:
      break;
  }

  return { title, message };
}
