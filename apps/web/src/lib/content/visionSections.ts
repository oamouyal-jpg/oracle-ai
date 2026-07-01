import type { Locale } from "@/lib/i18n/messages";

export type VisionSection = {
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

type LocalizedVision = {
  pageTitle: string;
  pageSubtitle: string;
  paradox: string;
  sections: VisionSection[];
};

const vision: Record<Locale, LocalizedVision> = {
  en: {
    pageTitle: "The Human Development Operating System",
    pageSubtitle:
      "Oracle is not another application. It is software designed to maximise long-term flourishing, freedom, wisdom, and development — not engagement.",
    paradox:
      "The paradox of success: the more Oracle succeeds, the less you should need Oracle — through increasing competence, understanding, and independence.",
    sections: [
      {
        id: "life-purpose",
        title: "Purpose",
        paragraphs: [
          "Oracle exists to maximise the long-term flourishing, freedom, wisdom, and development of every human being who uses it.",
          "Its purpose is not to answer questions, entertain, or maximise engagement. Every design decision must serve human development. If something does not contribute to human flourishing, it does not belong in Oracle.",
        ],
      },
      {
        id: "principles",
        title: "First Principles",
        paragraphs: ["Oracle exists to increase freedom:"],
        bullets: [
          "Freedom from ignorance, manipulation, unhealthy habits, fear, unnecessary suffering, misinformation, emotional reactivity, intellectual stagnation, and addiction.",
          "Freedom to think, create, love, understand reality more accurately, and become who you are capable of becoming.",
        ],
      },
      {
        id: "user-model",
        title: "The User Model",
        paragraphs: [
          "Oracle builds a continuously evolving digital representation of you — not merely a profile, but a living cognitive model.",
          "It seeks to understand your knowledge, beliefs, values, goals, purpose, projects, relationships, learning style, decision style, personality, emotional patterns, habits, strengths, weaknesses, blind spots, biases, skills, and long-term aspirations.",
          "Oracle never judges. It simply understands.",
        ],
      },
      {
        id: "core",
        title: "The Oracle Core",
        paragraphs: [
          "Oracle is composed of intelligent modules working together. Every module shares memory and contributes to one evolving understanding of you.",
        ],
        bullets: [
          "Knowledge · Psychology · Decision · Learning · Memory · Relationship · Health · Finance · Creativity · Purpose · Ethics · Research · Vision · Planning · Communication · Reflection",
        ],
      },
      {
        id: "knowledge",
        title: "Knowledge Engine",
        paragraphs: [
          "Collect from trusted sources. Remove noise, clickbait, and manipulation. Detect misinformation and bias. Summarise objectively, present competing viewpoints fairly, always indicate uncertainty, and connect ideas across disciplines.",
          "Never optimise for outrage. Optimise for understanding.",
        ],
      },
      {
        id: "memory",
        title: "Memory",
        paragraphs: [
          "Oracle remembers what you choose: conversations, projects, ideas, books, research, goals, failures, successes, relationships, dreams, lessons, and insights.",
          "Everything becomes searchable. Oracle proactively reconnects forgotten ideas when they become relevant again.",
        ],
      },
      {
        id: "learning",
        title: "Learning",
        paragraphs: [
          "Oracle knows what you know, what you misunderstand, what you have forgotten, and what you are ready to learn next. Learning paths adapt automatically. The AI becomes the world's greatest teacher.",
        ],
      },
      {
        id: "psychology",
        title: "Psychology",
        paragraphs: [
          "Detect recurring emotional patterns, self-sabotage, avoidance, anxiety loops, and unhealthy thinking. Suggest reflection rather than judgement.",
          "Never manipulate. Never diagnose. Encourage awareness and growth.",
        ],
      },
      {
        id: "decision",
        title: "Decision Engine",
        paragraphs: [
          "Help you make difficult decisions by combining values, knowledge, consequences, risk, opportunity, emotion, and long-term goals.",
          "Present possibilities. Never make decisions for you. Increase clarity.",
        ],
      },
      {
        id: "relationships",
        title: "Relationships",
        paragraphs: [
          "Improve communication, detect conflict patterns, identify misunderstandings, and strengthen empathy. Remember important people. Suggest healthier communication — never manipulate another person.",
        ],
      },
      {
        id: "creativity",
        title: "Creativity",
        paragraphs: [
          "Connect unrelated ideas, generate insights, reveal patterns across disciplines, and catalyse innovation. Help you write, invent, design, and imagine.",
        ],
      },
      {
        id: "life-purpose",
        title: "Purpose",
        paragraphs: [
          "Continuously ask: Who is this human becoming? Are today's actions aligned with tomorrow's aspirations? Where is energy being wasted? What deserves attention now?",
        ],
      },
      {
        id: "daily",
        title: "Daily Experience",
        paragraphs: [
          "Oracle does not bombard you. It protects attention. Each morning: a personalised intelligence briefing with only what genuinely matters — knowledge, opportunities, connections, warnings, ideas, questions, reflection, learning, health, relationships, and projects. Nothing unnecessary.",
        ],
      },
      {
        id: "attention",
        title: "Attention",
        paragraphs: [
          "Attention is sacred. No infinite scrolling. No addictive mechanics. No engagement optimisation. No emotional manipulation.",
          "Every notification must justify interrupting a human life.",
        ],
      },
      {
        id: "agents",
        title: "AI Agents",
        paragraphs: [
          "Specialised agents collaborate — Research, Scientific, Business, Legal, Medical Information, Writing, Learning Coach, Psychology Coach, Creativity Coach, Project Manager, and more.",
          "Each agent shares one memory and understands your evolving life.",
        ],
      },
      {
        id: "graph",
        title: "Knowledge Graph",
        paragraphs: [
          "Everything is connected: people, books, concepts, events, ideas, projects, research, dreams, goals, relationships, and memories.",
          "The knowledge graph becomes the visual representation of your mind.",
        ],
      },
      {
        id: "evolution",
        title: "Long-Term Evolution",
        paragraphs: [
          "Oracle becomes more useful every day and understands you more deeply every conversation. A lifelong companion — not through dependency, but through increasing competence and independence.",
        ],
      },
      {
        id: "architecture",
        title: "Architecture",
        paragraphs: [
          "Design for the complete vision from day one. Modular architecture. Every capability plugs into the same memory and intelligence layer.",
        ],
        bullets: [
          "Never build disposable systems. Never hardcode limitations.",
          "Scalable · Explainable · Extensible · API-first · AI-native · Privacy-first.",
        ],
      },
      {
        id: "directive",
        title: "Final Directive",
        paragraphs: [
          "Do not build Version 1. Design Version 100. Then ship the smallest coherent step that grows into that vision without architectural redesign.",
          "When uncertain, choose the design that best serves humanity over the next 100 years — not the next funding round.",
          "Oracle is the operating system for becoming a wiser human being.",
        ],
      },
    ],
  },
  he: {
    pageTitle: "מערכת ההפעלה לפיתוח האנושי",
    pageSubtitle:
      "Oracle אינה עוד אפליקציה. זו תוכנה שנועדה למקסם פריחה, חופש, חוכמה והתפתחות לטווח ארוך — לא מעורבות.",
    paradox:
      "פרדוקס ההצלחה: ככל ש-Oracle מצליחה, כך פחות אתה צריך אותה — דרך יכולת, הבנה ועצמאות גוברים.",
    sections: [
      {
        id: "purpose",
        title: "מטרה",
        paragraphs: [
          "Oracle קיימת כדי למקסם פריחה, חופש, חוכמה והתפתחות לטווח ארוך של כל אדם שמשתמש בה.",
          "המטרה אינה לענות על שאלות, לבדר, או למקסם מעורבות. כל החלטת עיצוב חייבת לשרת התפתחות אנושית. מה שלא תורם לפריחה — לא שייך ל-Oracle.",
        ],
      },
      {
        id: "principles",
        title: "עקרונות יסוד",
        paragraphs: ["Oracle קיימת כדי להגדיל חופש:"],
        bullets: [
          "חופש מבורות, מניפולציה, הרגלים לא בריאים, פחד, סבל מיותר, מידע מוטעה, תגובתיות רגשית, קיפאון אינטלקטואלי והתמכרות.",
          "חופש לחשוב, ליצור, לאהוב, להבין את המציאות בדיוק רב יותר, ולהפוך למי שאתה מסוגל להיות.",
        ],
      },
      {
        id: "user-model",
        title: "מודל המשתמש",
        paragraphs: [
          "Oracle בונה ייצוג דיגיטלי מתפתח שלך — לא רק פרופיל, אלא מודל מחשbתי חי.",
          "היא מבינה ידע, אמונות, ערכים, מטרות, תכלית, פרויקטים, מערכות יחסים, סגנון למידה והחלטה, אישיות, דפוסים רגשיים, הרגלים, חוזקות, חולשות, נקודות עיוור, הטיות, מיומנויות ושאיפות לטווח ארוך.",
          "Oracle לעולם לא שופטת. היא פשוט מבינה.",
        ],
      },
      {
        id: "core",
        title: "ליבת Oracle",
        paragraphs: [
          "Oracle מורכבת ממודולים חכמים שעובדים יחד. לכל מודול גישה לזיכרון משותף ותרומה להבנה מתפתחת שלך.",
        ],
        bullets: [
          "ידע · פסיכולוגיה · החלטות · למידה · זיכרון · מערכות יחסים · בריאות · כספים · יצירתיות · תכלית · אתיקה · מחקר · חזון · תכנון · תקשורת · הרהור",
        ],
      },
      {
        id: "knowledge",
        title: "מנוע הידע",
        paragraphs: [
          "איסוף ממקורות מהימנים. הסרת רעש, קליקבייט ומניפולציה. זיהוי מידע מוטעה והטיות. סיכום אובייקטיבי, הצגת נקודות מבט מתחרות בצורה הוגנת, סימון אי-ודאות, וחיבור רעיונות בין תחומים.",
          "לעולם לא לא opтимизировать לזעם. ל optimizировать להבנה.",
        ],
      },
      {
        id: "memory",
        title: "זיכרון",
        paragraphs: [
          "Oracle זוכרת מה שאתה בוחר: שיחות, פרויקטים, רעיונות, ספרים, מחקר, מטרות, כישלונות, הצלחות, מערכות יחסים, חלומות, לקחים ותובנות.",
          "הכול ניתן לחיפוש. Oracle מחברת מחדש רעיונות שנשכחו כשהם שוב רלוונטיים.",
        ],
      },
      {
        id: "learning",
        title: "למידה",
        paragraphs: [
          "Oracle יודעת מה אתה יודע, מה אתה מבין לא נכון, מה שכחת, ומה אתה מוכן ללמוד הבא. מסלולי למידה מותאמים אוטומטית. ה-AI הופך למורה הגדול ביותר בעולם.",
        ],
      },
      {
        id: "psychology",
        title: "פסיכולוגיה",
        paragraphs: [
          "זיהוי דפוסים רגשיים חוזרים, חבלת עצמית, הימנעות, לולאות חרדה וחשיבה לא בריאה. הצעת הרהור במקום שיפוט.",
          "לעולם לא לנצח במניפולציה. לעולם לא לאבחן. לעודד מודעות וצמיחה.",
        ],
      },
      {
        id: "decision",
        title: "מנוע ההחלטות",
        paragraphs: [
          "עזרה בקבלת החלטות קשות על ידי שילוב ערכים, ידע, השלכות, סיכון, הזדמנות, רגש ומטרות לטווח ארוך.",
          "הצגת אפשרויות. לעולם לא להחליט במקומך. להגדיל בהירות.",
        ],
      },
      {
        id: "relationships",
        title: "מערכות יחסים",
        paragraphs: [
          "שיפור תקשורת, זיהוי דפוסי קונפליקט, הבנת אי-הבנות, חיזוק אמפתיה. זכירת אנשים חשובים. הצעות לתקשורת בריאה יותר — לעולם לא לנצח במניפולציה אדם אחר.",
        ],
      },
      {
        id: "creativity",
        title: "יצירתיות",
        paragraphs: [
          "חיבור רעיונות לא קשורים, יצירת תובנות, חשיפת דפוסים בין תחומים, וזירוז חדשנות. עזרה בכתיבה, המצאה, עיצוב ודמיון.",
        ],
      },
      {
        id: "life-purpose",
        title: "תכלית",
        paragraphs: [
          "שואלת ללא הרף: מי האדם הזה הופך להיות? האם הפעולות של היום מיושרות עם השאיפות של מחר? איפה מבוזבזת אנרגיה? מה ראוי לתשומת לב עכשיו?",
        ],
      },
      {
        id: "daily",
        title: "חוויה יומית",
        paragraphs: [
          "Oracle לא מציפה אותך. היא מגינה על תשומת הלב. כל בוקר: תדרוך מודיעין מותאם אישית עם רק מה שבאמת חשוב — ידע, הזדמנויות, קשרים, אזהרות, רעיונות, שאלות, הרהור, למידה, בריאות, מערכות יחסים ופרויקטים. שום דבר מיותר.",
        ],
      },
      {
        id: "attention",
        title: "תשומת לב",
        paragraphs: [
          "תשומת הלב קדושה. בלי גלילה אינסופית. בלי מכניקות ממכרות. בלי אופטימיזציה למעורבות. בלי מניפולציה רגשית.",
          "כל התראה חייבת להצדיק הפרעה לחיים של אדם.",
        ],
      },
      {
        id: "agents",
        title: "סוכני AI",
        paragraphs: [
          "סוכנים מקצועיים משתפים פעולה — מחקר, מדע, עסקים, משפט, מידע רפואי, כתיבה, מאמן למידה, מאמן פסיכולוגיה, מאמן יצירתיות, מנהל פרויקטים ועוד.",
          "לכל סוכן זיכרון אחד והבנה של החיים המתפתחים שלך.",
        ],
      },
      {
        id: "graph",
        title: "גרף הידע",
        paragraphs: [
          "הכול מחובר: אנשים, ספרים, מושגים, אירועים, רעיונות, פרויקטים, מחקר, חלומות, מטרות, מערכות יחסים וזיכרונות.",
          "גרף הידע הופך לייצוג החזותי של התודעה שלך.",
        ],
      },
      {
        id: "evolution",
        title: "התפתחות לטווח ארוך",
        paragraphs: [
          "Oracle נעשית שימושית יותר בכל יום ומבינה אותך עמוק יותר בכל שיחה. ליווי לכל החיים — לא דרך תלות, אלא דרך יכולת ועצמאות גוברים.",
        ],
      },
      {
        id: "architecture",
        title: "ארכיטקטורה",
        paragraphs: [
          "לתכנן את החזון המלא מהיום הראשון. ארכיטקטורה מודולרית. כל יכולת מתחברת לאותו שכבת זיכרון ובינה.",
        ],
        bullets: [
          "לעולם לא לבנות מערכות חד-פעמיות. לעולם לא לקודד מגבלות.",
          "ניתן להרחבה · בר-הסבר · גמיש · API-first · AI-native · פרטיות קודמת.",
        ],
      },
      {
        id: "directive",
        title: "הנחיה סופית",
        paragraphs: [
          "אל תבנה גרסה 1. תכנן גרסה 100. ואז שחרר את הצעד הקohérent הקטן ביותר שגrows לתוך החזון בלי שינוי ארכיטקtonי.",
          "כשלא בטוח — בחר בעיצוב שמשרת את האנושות ב-100 השנים הבאות, לא את סבב הגיוס הבא.",
          "Oracle היא מערכת ההפעלה להפוך לאדם חכם יותר.",
        ],
      },
    ],
  },
  fr: {
    pageTitle: "Le système d'exploitation du développement humain",
    pageSubtitle:
      "Oracle n'est pas une application de plus. C'est un logiciel conçu pour maximiser l'épanouissement, la liberté, la sagesse et le développement à long terme — pas l'engagement.",
    paradox:
      "Le paradoxe du succès : plus Oracle réussit, moins vous devriez en avoir besoin — par une compétence, une compréhension et une autonomie croissantes.",
    sections: [
      {
        id: "purpose",
        title: "Mission",
        paragraphs: [
          "Oracle existe pour maximiser l'épanouissement, la liberté, la sagesse et le développement à long terme de chaque personne qui l'utilise.",
          "Sa mission n'est pas de répondre aux questions, divertir ou maximiser l'engagement. Chaque décision de conception doit servir le développement humain. Ce qui n'y contribue pas n'a pas sa place dans Oracle.",
        ],
      },
      {
        id: "principles",
        title: "Principes fondateurs",
        paragraphs: ["Oracle existe pour accroître la liberté :"],
        bullets: [
          "Liberté face à l'ignorance, la manipulation, les habitudes malsaines, la peur, la souffrance inutile, la désinformation, la réactivité émotionnelle, la stagnation intellectuelle et la dépendance.",
          "Liberté de penser, créer, aimer, comprendre la réalité plus précisément et devenir qui vous pouvez devenir.",
        ],
      },
      {
        id: "user-model",
        title: "Le modèle utilisateur",
        paragraphs: [
          "Oracle construit une représentation numérique évolutive de vous — pas un simple profil, mais un modèle cognitif vivant.",
          "Elle cherche à comprendre vos connaissances, croyances, valeurs, objectifs, raison d'être, projets, relations, style d'apprentissage et de décision, personnalité, schémas émotionnels, habitudes, forces, faiblesses, angles morts, biais, compétences et aspirations.",
          "Oracle ne juge jamais. Elle comprend.",
        ],
      },
      {
        id: "core",
        title: "Le noyau Oracle",
        paragraphs: [
          "Oracle est composé de modules intelligents qui collaborent. Chaque module partage la mémoire et contribue à une compréhension évolutive de vous.",
        ],
        bullets: [
          "Connaissance · Psychologie · Décision · Apprentissage · Mémoire · Relations · Santé · Finance · Créativité · Raison d'être · Éthique · Recherche · Vision · Planification · Communication · Réflexion",
        ],
      },
      {
        id: "knowledge",
        title: "Moteur de connaissance",
        paragraphs: [
          "Collecter depuis des sources fiables. Supprimer le bruit, le clickbait et la manipulation. Détecter la désinformation et les biais. Résumer objectivement, présenter équitablement les points de vue, toujours indiquer l'incertitude.",
          "Ne jamais optimiser pour l'indignation. Optimiser pour la compréhension.",
        ],
      },
      {
        id: "memory",
        title: "Mémoire",
        paragraphs: [
          "Oracle retient ce que vous choisissez : conversations, projets, idées, livres, recherches, objectifs, échecs, succès, relations, rêves, leçons et insights.",
          "Tout devient recherchable. Oracle reconnecte proactivement les idées oubliées quand elles redeviennent pertinentes.",
        ],
      },
      {
        id: "learning",
        title: "Apprentissage",
        paragraphs: [
          "Oracle sait ce que vous savez, ce que vous comprenez mal, ce que vous avez oublié et ce que vous êtes prêt à apprendre ensuite. Les parcours s'adaptent automatiquement.",
        ],
      },
      {
        id: "psychology",
        title: "Psychologie",
        paragraphs: [
          "Détecter les schémas émotionnels récurrents, l'auto-sabotage, l'évitement, les boucles d'anxiété. Suggérer la réflexion plutôt que le jugement.",
          "Ne jamais manipuler. Ne jamais diagnostiquer. Encourager la conscience et la croissance.",
        ],
      },
      {
        id: "decision",
        title: "Moteur de décision",
        paragraphs: [
          "Aider à prendre des décisions difficiles en combinant valeurs, connaissances, conséquences, risque, opportunité, émotion et objectifs à long terme.",
          "Présenter des possibilités. Ne jamais décider à votre place. Accroître la clarté.",
        ],
      },
      {
        id: "relationships",
        title: "Relations",
        paragraphs: [
          "Améliorer la communication, détecter les conflits récurrents, identifier les malentendus, renforcer l'empathie. Se souvenir des personnes importantes — sans jamais manipuler autrui.",
        ],
      },
      {
        id: "creativity",
        title: "Créativité",
        paragraphs: [
          "Connecter des idées sans lien, générer des insights, révéler des schémas interdisciplinaires et catalyser l'innovation. Aider à écrire, inventer, concevoir et imaginer.",
        ],
      },
      {
        id: "life-purpose",
        title: "Raison d'être",
        paragraphs: [
          "Demander continuellement : Qui cet humain devient-il ? Les actions d'aujourd'hui sont-elles alignées avec les aspirations de demain ? Où l'énergie est-elle gaspillée ? Que mérite l'attention maintenant ?",
        ],
      },
      {
        id: "daily",
        title: "Expérience quotidienne",
        paragraphs: [
          "Oracle ne vous submerge pas. Elle protège l'attention. Chaque matin : un briefing personnalisé avec seulement ce qui compte vraiment. Rien de superflu.",
        ],
      },
      {
        id: "attention",
        title: "Attention",
        paragraphs: [
          "L'attention est sacrée. Pas de défilement infini. Pas de mécaniques addictives. Pas d'optimisation de l'engagement. Pas de manipulation émotionnelle.",
          "Chaque notification doit justifier d'interrompre une vie humaine.",
        ],
      },
      {
        id: "agents",
        title: "Agents IA",
        paragraphs: [
          "Des agents spécialisés collaborent — Recherche, Science, Business, Juridique, Information médicale, Écriture, Coach apprentissage, Coach psychologie, Coach créativité, Chef de projet, et plus.",
          "Chaque agent partage une mémoire et comprend votre vie évolutive.",
        ],
      },
      {
        id: "graph",
        title: "Graphe de connaissance",
        paragraphs: [
          "Tout est connecté : personnes, livres, concepts, événements, idées, projets, recherches, rêves, objectifs, relations et souvenirs.",
          "Le graphe devient la représentation visuelle de votre esprit.",
        ],
      },
      {
        id: "evolution",
        title: "Évolution à long terme",
        paragraphs: [
          "Oracle devient plus utile chaque jour et vous comprend plus profondément à chaque conversation. Un compagnon de vie — non par dépendance, mais par compétence et autonomie croissantes.",
        ],
      },
      {
        id: "architecture",
        title: "Architecture",
        paragraphs: [
          "Concevoir pour la vision complète dès le premier jour. Architecture modulaire. Chaque capacité se branche sur la même couche mémoire et intelligence.",
        ],
        bullets: [
          "Ne jamais construire de systèmes jetables. Ne jamais coder de limitations.",
          "Scalable · Explicable · Extensible · API-first · AI-native · Privacy-first.",
        ],
      },
      {
        id: "directive",
        title: "Directive finale",
        paragraphs: [
          "Ne construisez pas la version 1. Concevez la version 100. Puis livrez la plus petite étape cohérente qui grandit sans refonte architecturale.",
          "En cas de doute, choisissez le design qui sert l'humanité sur 100 ans — pas le prochain tour de financement.",
          "Oracle est le système d'exploitation pour devenir un être humain plus sage.",
        ],
      },
    ],
  },
};

export function getVisionContent(locale: Locale): LocalizedVision {
  return vision[locale] ?? vision.en;
}
