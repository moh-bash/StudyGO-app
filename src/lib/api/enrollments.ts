import { api } from './client';

export interface Enrollment {
  id: string;
  sectionId: string;
  status: string;
}

export const enrollmentsApi = {
  create: (sectionId: string): Promise<Enrollment> =>
    api.post<Enrollment>('/enrollments', { sectionId }, { auth: true }),
  drop: (id: string): Promise<Enrollment> =>
    api.patch<Enrollment>(`/enrollments/${id}/drop`, undefined, { auth: true }),
};
