export const padNumber = (value) => {
  return String(value).padStart(2, "0");
};

export const formatDateLocal = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "";
  }

  return `${date.getFullYear()}-${padNumber(
    date.getMonth() + 1
  )}-${padNumber(date.getDate())}`;
};

export const parseDateLocal = (dateString) => {
  if (!dateString) {
    return null;
  }

  const [year, month, day] = String(dateString)
    .split("-")
    .map(Number);

  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day);
};

export const isTodayDate = (date) => {
  if (!(date instanceof Date)) {
    return false;
  }

  const today = new Date();

  return (
    today.getFullYear() === date.getFullYear() &&
    today.getMonth() === date.getMonth() &&
    today.getDate() === date.getDate()
  );
};

export const getDaysInMonth = (year, month) => {
  return new Date(year, month, 0).getDate();
};

export const getFirstWeekday = (year, month) => {
  return new Date(year, month - 1, 1).getDay();
};

export const buildCalendarDays = (year, month) => {
  const firstWeekday = getFirstWeekday(year, month);
  const daysInMonth = getDaysInMonth(year, month);

  const previousMonthDays = getDaysInMonth(
    year,
    month - 1
  );

  const days = [];

  // Domingo = 0.
  // El calendario visual comienza el domingo.
  for (let index = firstWeekday - 1; index >= 0; index -= 1) {
    const dayNumber = previousMonthDays - index;

    const date = new Date(
      year,
      month - 2,
      dayNumber
    );

    days.push({
      date,
      isCurrentMonth: false,
    });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    days.push({
      date: new Date(year, month - 1, day),
      isCurrentMonth: true,
    });
  }

  const totalCells = Math.ceil(days.length / 7) * 7;
  const remainingCells = totalCells - days.length;

  for (let day = 1; day <= remainingCells; day += 1) {
  days.push({
    date: new Date(year, month, day),
    isCurrentMonth: false,
  });
}

  return days;
};

export const groupMeetingsByDate = (meetings = []) => {
  return meetings.reduce((groups, meeting) => {
    if (!meeting?.date) {
      return groups;
    }

    if (!groups[meeting.date]) {
      groups[meeting.date] = [];
    }

    groups[meeting.date].push(meeting);

    return groups;
  }, {});
};

export const sortMeetings = (meetings = []) => {
  return [...meetings].sort((a, b) => {
    const dateA = `${a.date || ""} ${a.time || ""}`;
    const dateB = `${b.date || ""} ${b.time || ""}`;

    return dateA.localeCompare(dateB);
  });
};

export const getPreviousMonth = (year, month) => {
  if (month === 1) {
    return {
      year: year - 1,
      month: 12,
    };
  }

  return {
    year,
    month: month - 1,
  };
};

export const getNextMonth = (year, month) => {
  if (month === 12) {
    return {
      year: year + 1,
      month: 1,
    };
  }

  return {
    year,
    month: month + 1,
  };
};

export const getMonthLabel = (year, month) => {
  const date = new Date(year, month - 1, 1);

  const label = date.toLocaleDateString("es-PE", {
    month: "long",
    year: "numeric",
  });

  return label.charAt(0).toUpperCase() + label.slice(1);
};