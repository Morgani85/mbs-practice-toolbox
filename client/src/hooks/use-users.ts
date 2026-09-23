import { useQuery } from "@tanstack/react-query";

interface User {
  id: number;
  firstName: string | null;
  lastName: string | null;
  email: string;
}

export function useUsers() {
  const { data: users } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const getUserName = (userId: number | null | undefined): string => {
    if (!userId) return "—";
    const user = users?.find((u) => u.id === userId);
    if (!user) return "—";
    const name = [user.firstName, user.lastName].filter(Boolean).join(" ");
    return name || user.email;
  };

  return { users, getUserName };
}
