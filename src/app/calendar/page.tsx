import { CalendarView } from "@/components/calendar/CalendarView";

export const metadata = {
  title: "캘린더 | jucalch",
  description: "주식 이벤트를 월별 캘린더로 확인하세요.",
};

export default function CalendarPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <CalendarView />
    </div>
  );
}
