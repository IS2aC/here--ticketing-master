// « Une question ? » : discussion de l'organisateur avec l'assistant et l'équipe Here!.

export type SupportStatus = "assistant" | "waiting" | "answered" | "closed";

export type SupportMessage = {
  id: string;
  author: "organizer" | "assistant" | "staff";
  body: string;
  created_at: string;
  staff_name: string | null; // prénom du membre de l'équipe
};

export type SupportConversation = {
  id: string;
  status: SupportStatus;
  created_at: string;
  updated_at: string;
  messages: SupportMessage[];
};

export type SupportThread = SupportConversation & {
  organizer_id: string;
  organizer_name: string;
  organizer_phone: string;
  organization: string | null;
};
