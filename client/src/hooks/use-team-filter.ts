import { useState, useEffect } from "react";

const TEAM_FILTER_KEY = "practice-toolbox-selected-team";

export const useTeamFilter = () => {
  const [selectedTeam, setSelectedTeam] = useState<number | null>(() => {
    // Initialize from localStorage on first load
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(TEAM_FILTER_KEY);
      return saved ? parseInt(saved) : null;
    }
    return null;
  });

  const updateSelectedTeam = (teamId: number | null) => {
    setSelectedTeam(teamId);
    
    // Save to localStorage
    if (typeof window !== "undefined") {
      if (teamId === null) {
        localStorage.removeItem(TEAM_FILTER_KEY);
      } else {
        localStorage.setItem(TEAM_FILTER_KEY, teamId.toString());
      }
    }
  };

  return {
    selectedTeam,
    setSelectedTeam: updateSelectedTeam,
  };
};