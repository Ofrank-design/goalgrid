import data from "@/content/info/contact.json";
import { InfoPage } from "@/components/site/InfoPage";
import { ContactForm } from "@/components/site/ContactForm";
export const metadata = { title: `${data.title} | GoalGrid`, description: data.lead };
export default function Page() { return <InfoPage data={data} form={<ContactForm />} />; }
