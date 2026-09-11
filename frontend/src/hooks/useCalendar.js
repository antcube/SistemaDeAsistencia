import { useCallback, useEffect, useState } from "react";
import meetingService from "../services/meetingService";
import scheduleService from "../services/scheduleService";
import circleService from "../services/circleService";
import { sortMeetings } from "../utils/calendarUtils";

const getMonthData = (response) => {
  if (Array.isArray(response)) {
    return response;
  }

  if (Array.isArray(response?.meetings)) {
    return response.meetings;
  }

  if (Array.isArray(response?.data)) {
    return response.data;
  }

  return [];
};

const getScheduleData = (response) => {
  if (Array.isArray(response)) {
    return response;
  }

  if (Array.isArray(response?.schedules)) {
    return response.schedules;
  }

  if (Array.isArray(response?.data)) {
    return response.data;
  }

  return [];
};

const getCircleData = (response) => {
  if (Array.isArray(response)) {
    return response;
  }

  if (Array.isArray(response?.circles)) {
    return response.circles;
  }

  if (Array.isArray(response?.data)) {
    return response.data;
  }

  return [];
};

const useCalendar = (year, month) => {
  const [meetings, setMeetings] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [circles, setCircles] = useState([]);

  const [loading, setLoading] = useState(true);
  const [loadingCircles, setLoadingCircles] = useState(true);

  const [error, setError] = useState("");

  const [filters, setFilters] = useState({
    circle: "",
    type: "",
  });

  const loadCalendar = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await meetingService.getMeetings(
        year,
        month,
        filters
      );

      const data = getMonthData(response);

      setMeetings(sortMeetings(data));
    } catch (err) {
      console.error("Error cargando calendario:", err);

      setError(
        err?.message ||
          "No se pudieron cargar las reuniones."
      );

      setMeetings([]);
    } finally {
      setLoading(false);
    }
  }, [year, month, filters.circle, filters.type]);

  const loadSchedules = useCallback(async () => {
    try {
      const response = await scheduleService.getSchedules(
        filters.circle
      );

      setSchedules(getScheduleData(response));
    } catch (err) {
      console.error(
        "Error cargando programaciones:",
        err
      );

      setSchedules([]);
    }
  }, [filters.circle]);

  const loadCircles = useCallback(async () => {
    try {
      setLoadingCircles(true);

      const response = await circleService.getCircles();

      setCircles(getCircleData(response));
    } catch (err) {
      console.error("Error cargando círculos:", err);

      setCircles([]);
    } finally {
      setLoadingCircles(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    await Promise.all([
      loadCalendar(),
      loadSchedules(),
    ]);
  }, [loadCalendar, loadSchedules]);

  useEffect(() => {
    loadCircles();
  }, [loadCircles]);

  useEffect(() => {
    loadCalendar();
  }, [loadCalendar]);

  useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);

  const setCircleFilter = (circle) => {
    setFilters((previous) => ({
      ...previous,
      circle,
    }));
  };

  const setTypeFilter = (type) => {
    setFilters((previous) => ({
      ...previous,
      type,
    }));
  };

  const clearFilters = () => {
    setFilters({
      circle: "",
      type: "",
    });
  };

  return {
    meetings,
    schedules,
    circles,

    loading,
    loadingCircles,
    error,

    filters,

    setCircleFilter,
    setTypeFilter,
    clearFilters,

    refresh,
  };
};

export default useCalendar;