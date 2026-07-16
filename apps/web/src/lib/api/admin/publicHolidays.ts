import { apiFetch } from "../client";
import type { PublicHolidayView } from "@/types/api";

export async function listPublicHolidays(accessToken: string): Promise<PublicHolidayView[]> {
  const res = await apiFetch<{ success: true; data: PublicHolidayView[] }>(
    "/admin/public-holidays",
    { accessToken },
  );
  return res.data;
}

export async function createPublicHoliday(
  accessToken: string,
  params: { date: string; name: string },
): Promise<PublicHolidayView> {
  const res = await apiFetch<{ success: true; data: PublicHolidayView }>(
    "/admin/public-holidays",
    { method: "POST", accessToken, body: params },
  );
  return res.data;
}

export async function deletePublicHoliday(accessToken: string, id: string): Promise<void> {
  await apiFetch<{ success: true; data: null }>(`/admin/public-holidays/${id}`, {
    method: "DELETE",
    accessToken,
  });
}
