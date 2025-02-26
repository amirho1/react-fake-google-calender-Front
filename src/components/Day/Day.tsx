import { convertToHTML } from "draft-convert";
import { EditorState } from "draft-js";
import moment, { Moment } from "moment-jalaali";
import React, {
  createContext,
  FC,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { ReduxStateI } from "../../redux";
import { EventI } from "../../redux/reducers/events/events";
import { CalendarI } from "../../redux/sagas/calendars";
import { addEvent, getEvents } from "../../redux/sagas/events";
import {
  convertEnglishWeekdaysToPersian,
  convertHoursToMinutes,
  convertMinutesToHours,
  isSameDate,
  roundSpecific,
} from "../../utils/helpers";
import ContextMenu from "../ContextMenu/ContextMenu";
import Details from "../Details/Details";
import EventForm from "../EventForm/EventForm";
import HoverCircle from "../HoverCircle/HoverCircle";
import Line from "../Line/Line";
import Modal from "../Modal/Modal";
import TimeLine from "../TimeLine/TimeLine";
import styles from "./Day.module.scss";
import { useImmerReducer } from "use-immer";
import Plus from "../Plus/Plus";
import { FadeContext, SidebarContext } from "../../App";
import Event from "../Event/Event";
import NewEvent from "../NewEvent/NewEvent";
import WholeDay from "../WholeDay/WholeDay";

interface DayProps {}

export type OnDateChangeT = (newDate: Moment) => void;

export const centerOFScreen = () => ({
  x: window.innerWidth / 2 - 225,
  y: window.innerHeight / 2 - 225,
});

function drawCalendarLines(num: number) {
  const lines: JSX.Element[] = [];

  for (let i = 0; i < num; i++) {
    const line = (
      <Line
        key={i}
        color="var(--gray)"
        width="100%"
        height="1px"
        hour={i ? i : undefined}
      />
    );
    lines.push(line);
  }

  return lines;
}

const eventFormDefaultValue: EventFormI = {
  ...centerOFScreen(),
  title: "",
  description: EditorState.createEmpty(),
  date: moment(),
  display: false,
  eventStartTime: 0,
  eventEndTime: 0,
  color: "blue",
  calId: "",
  hidden: false,
  wholeDayDisplay: false,
};

export interface EventFormI {
  title: string;
  description: EditorState;
  date: moment.Moment;
  display: boolean;
  eventStartTime: number;
  eventEndTime: number;
  color: string;
  calId: string;
  x: number;
  y: number;
  hidden: boolean;
  timestampEnd?: number;
  wholeDayDisplay: boolean;
}

export const EventFormContext = createContext<{
  eventForm: EventFormI;
  setEventForm: React.Dispatch<React.SetStateAction<EventFormI>>;
}>({
  eventForm: eventFormDefaultValue,
  setEventForm: () => {},
});

export interface EventDetailsI extends EventI {
  display: boolean;
}

export type OnColorChangeT = (color: string) => void;

export interface EventFormStateI {
  title: string;
  description: EditorState;
  date: moment.Moment;
  display: boolean;
  eventStartTime: number;
  eventEndTime: number;
  color: string;
  calId: string;
  x: number;
  y: number;
}

const Day: FC<DayProps> = () => {
  const { closeFade } = useContext(FadeContext);
  const mainRef = useRef<HTMLDivElement>(null);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [headerBottomBorderDisplay, setHeaderBottomBorderDisplay] = useState(0);
  const [timeLineMinutes, setTimeLineMinutes] = useState(0);
  const [isMoved, setIsMoved] = useState(false);

  const [details, setDetails] = useState<EventDetailsI>({
    display: false,
    title: "",
    description: "",
    startTime: 0,
    endTime: 0,
    calId: "",
    color: "",
    _id: "",
    timeStamp: 0,
    timeStampEnd: undefined,
  });

  const calendars = useSelector<ReduxStateI, CalendarI[]>(
    state => state.calendars.calendars
  );

  const dispatch = useDispatch();
  const [eventFormModalRef, setEventFormModalRef] =
    useState<React.RefObject<HTMLDivElement>>();
  const getRef = useCallback(
    (ref: React.RefObject<HTMLDivElement>) => setEventFormModalRef(ref),
    []
  );

  const [contextMenuStates, dispatchContextMenuStates] = useImmerReducer(
    (draft, action) => {
      switch (action.type) {
        case "contextMenuCoordinate":
          draft.x = action.payload.x;
          draft.y = action.payload.y;
          break;
        case "contextMenuDisplay":
          draft.display = action.payload.display;
          break;
        case "contextMenuId":
          draft.id = action.payload.id;
          break;
        case "contextMenuCalId":
          draft.calId = action.payload.calId;
          break;
        default:
          break;
      }
    },
    {
      x: 0,
      y: 0,
      display: false,
      id: "",
      calId: "",
    }
  );

  const date = useSelector<ReduxStateI, Moment>(state => state.date.date);
  const timeStamp = useMemo(() => date.valueOf(), [date]);

  const [events, wholeDayEvents] = useSelector<
    ReduxStateI,
    [EventI[], EventI[]]
  >(state => {
    const calendars = state.calendars.calendars.filter(cal => cal.selected);
    const normEvent: EventI[] = calendars.reduce((prev: EventI[], next) => {
      return prev
        .concat(
          state.events &&
            next._id &&
            state.events.events[next._id] &&
            state.events.events[next._id][timeStamp]
            ? state.events.events[next._id][timeStamp]
            : []
        )
        .filter(e => !e.timeStampEnd);
    }, []);
    const wholeDayEvents: EventI[] = calendars.reduce(
      (prev: EventI[], next) => {
        return prev
          .concat(
            state.events &&
              next._id &&
              state.events.events[next._id] &&
              state.events.events[next._id][timeStamp]
              ? state.events.events[next._id][timeStamp]
              : []
          )
          .filter(e => e.timeStampEnd);
      },
      []
    );

    return [normEvent, wholeDayEvents];
  });

  const day = useMemo(() => date.format("jDD"), [date]);

  const weekday = useMemo(
    () =>
      convertEnglishWeekdaysToPersian(date.format("dddd").toLowerCase() as any),
    [date]
  );

  const [eventForm, setEventForm] = useState<EventFormI>({
    ...centerOFScreen(),
    title: "",
    description: EditorState.createEmpty(),
    date: date.clone(),
    display: false,
    eventStartTime: 0,
    eventEndTime: 0,
    color: "blue",
    calId: "",
    hidden: false,
    wholeDayDisplay: false,
  });

  // if there is any calendar set the first one to the eventForm.calId
  useEffect(() => {
    setEventForm(current => ({ ...current, calId: calendars[0]?._id || "" }));
  }, [calendars]);

  useEffect(() => {
    if (date.format("YYYY/MM/DD") === moment().format("YYYY/MM/DD")) {
      const id = setInterval(
        () => setTimeLineMinutes(convertHoursToMinutes(moment())),
        1000
      );

      return () => clearInterval(id);
    }
  }, [date]);

  const onStartTimeChange = useCallback(
    (startTime: number) =>
      setEventForm(current => {
        return { ...current, eventStartTime: startTime };
      }),
    []
  );

  const onEndTimeChang = useCallback((endTime: number) => {
    setEventForm(current => {
      return { ...current, eventEndTime: endTime - current.eventStartTime };
    });
  }, []);

  const onClickCreateEvent = useCallback<
    React.MouseEventHandler<HTMLDivElement>
  >(
    e => {
      // prevent from right click
      if (e.button === 2 || eventForm.display) return;
      setIsMouseDown(true);
      const { y } = e.currentTarget.getBoundingClientRect();
      const eventStartTime = roundSpecific(e.clientY - y, 15);
      const dateClone = date.clone();
      const time = convertMinutesToHours(eventStartTime).split(" ")[0];
      const h = +time.split(":")[0];
      const m = +time.split(":")[1];

      dateClone.set({ h, m });

      setEventForm(current => ({
        ...current,
        eventStartTime: roundSpecific(e.clientY - y, 15),
        eventEndTime: 60,
      }));
    },
    [eventForm.display, date]
  );

  const onClick = useCallback<React.MouseEventHandler<HTMLDivElement>>(
    e => {
      if (e.button === 2 && isMouseDown && !isMoved) return;
      setEventForm(current => {
        return {
          ...current,
          display: !current?.display,
          wholeDayDisplay: false,
          calName: calendars[0]?.name,
        };
      });
      setIsMouseDown(true);
    },
    [calendars, isMouseDown, isMoved]
  );

  const onEventFormHeaderMouseDown = useCallback<
    React.MouseEventHandler<HTMLDivElement>
  >(
    e => {
      // coordinate on mousedown
      let x = e?.clientX;
      let y = e?.clientY;
      const { x: previousX, y: previousY } =
        eventFormModalRef && eventFormModalRef?.current
          ? eventFormModalRef?.current?.getBoundingClientRect()
          : { x: 0, y: 0 };

      const onMouseMove = (event: MouseEvent) => {
        if (eventFormModalRef && eventFormModalRef?.current?.style) {
          const dx = event?.clientX - x;
          const dy = event?.clientY - y;

          eventFormModalRef.current.style.top = `${previousY + dy}px`;
          eventFormModalRef.current.style.left = `${previousX + dx}px`;
        }
      };

      const onMouseUp = (e: MouseEvent) => {
        e.stopPropagation();

        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        setIsMouseDown(false);
      };
      setIsMouseDown(true);
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [eventFormModalRef]
  );

  const closeModalEventForm = useCallback(() => {
    setEventForm(current => ({
      ...current,
      display: false,
      wholeDayDisplay: false,
      timestampEnd: undefined,
    }));
  }, []);

  // fetch events
  useEffect(() => {
    calendars.forEach(calendar => {
      if (calendar?.selected && calendar._id) {
        dispatch(
          getEvents.ac({
            timeStamp: `${timeStamp}`,
            calId: calendar._id,
          })
        );
      }
    });
  }, [dispatch, timeStamp, calendars]);

  const onDescriptionChange = useCallback((editorState: EditorState) => {
    setEventForm(current => ({ ...current, description: editorState }));
  }, []);

  const onTitleChange = useCallback((newDescription: string) => {
    setEventForm(current => ({ ...current, title: newDescription }));
  }, []);

  const handleAddingEvent = useCallback(() => {
    const event: EventI = {
      description: convertToHTML(eventForm.description.getCurrentContent()),
      endTime: eventForm.eventEndTime,
      startTime: eventForm.eventStartTime,
      title: eventForm.title,
      color: eventForm.color,
      calId: eventForm.calId,
      timeStamp: timeStamp,
      timeStampEnd: eventForm.timestampEnd || undefined,
    };

    dispatch(addEvent.ac({ body: event, calId: eventForm.calId, timeStamp }));
    setEventForm(current => ({
      ...current,
      display: false,
      wholeDayDisplay: false,
      eventEndTime: 0,
      description: EditorState.createEmpty(),
      title: "",
      eventStartTime: 0,
      timestampEnd: undefined,
    }));
  }, [dispatch, timeStamp, eventForm]);

  const onEventBottomMouseDownSetIsMouseDownTrue = useCallback(() => {
    setIsMouseDown(true);
    setIsMoved(false);
  }, []);

  const onBottomBorderMouseUp = useCallback(() => {
    setIsMouseDown(false);
    setIsMoved(false);
  }, []);

  const onBottomBorderMouseMove = useCallback(() => {
    setIsMoved(true);
  }, []);

  const onEventRightClick = useCallback(
    (
      e: React.MouseEvent<HTMLDivElement, MouseEvent>,
      id: string,
      calId: string
    ) => {
      e.stopPropagation();
      dispatchContextMenuStates({
        type: "contextMenuCoordinate",
        payload: { x: e.clientX, y: e.clientY },
      });
      dispatchContextMenuStates({
        type: "contextMenuDisplay",
        payload: { display: true },
      });
      dispatchContextMenuStates({
        type: "contextMenuId",
        payload: { id: id },
      });
      dispatchContextMenuStates({
        type: "contextMenuCalId",
        payload: { calId: calId },
      });
    },
    [dispatchContextMenuStates]
  );

  const closeContextMenu = useCallback(() => {
    dispatchContextMenuStates({
      type: "contextMenuDisplay",
      payload: { display: false },
    });
  }, [dispatchContextMenuStates]);

  const onEventClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement, MouseEvent>, event: EventI) => {
      if (e.buttons === 2) return;
      dispatchContextMenuStates({
        type: "contextMenuDisplay",
        payload: { display: false },
      });
      if (!isMoved)
        setDetails(current => ({
          ...current,
          ...event,
          display: !current.display,
        }));
    },
    [dispatchContextMenuStates, isMoved]
  );

  const onDocumentClickCloseModals = useCallback(() => {
    dispatchContextMenuStates({
      type: "contextMenuDisplay",
      payload: { display: false },
    });
    setEventForm(current => ({
      ...current,
      display: false,
      wholeDayDisplay: false,
    }));
    setDetails(current => ({ ...current, display: false }));

    closeFade();
  }, [closeFade, dispatchContextMenuStates]);

  useEffect(() => {
    document.addEventListener("mousedown", onDocumentClickCloseModals);
    mainRef?.current?.addEventListener(
      "contextmenu",
      onDocumentClickCloseModals
    );

    return () => {
      document?.removeEventListener("mousedown", onDocumentClickCloseModals);
      mainRef?.current?.removeEventListener(
        "contextmenu",
        onDocumentClickCloseModals
      );
    };
  }, [onDocumentClickCloseModals]);

  const closeDetails = useCallback(
    () => setDetails(current => ({ ...current, display: false })),
    []
  );

  const { display: sideBarDisplay } = useContext(SidebarContext);

  const onPlusClickOpenEventForm = useCallback(() => {
    setEventForm(current => ({
      ...current,
      display: true,
      wholeDayDisplay: false,
    }));
  }, []);

  const onCalChange = useCallback((calId: string) => {
    setEventForm(current => ({ ...current, calId }));
  }, []);

  const onColorChange = useCallback<OnColorChangeT>(color => {
    setEventForm(current => ({ ...current, color }));
  }, []);

  const isCurrentDate = useMemo(() => isSameDate(date, moment()), [date]);

  const onNewEventResize = useCallback((height: number | undefined) => {
    height && setEventForm(current => ({ ...current, eventEndTime: height }));
  }, []);

  const onNewEventMove = useCallback((startTime: number) => {
    setEventForm(current => ({ ...current, eventStartTime: startTime }));
  }, []);

  const onNewEventMouseDown = useCallback(() => {
    setEventForm(current => ({ ...current, hidden: true }));
  }, []);

  const onNewEventMouseUp = useCallback(() => {
    setEventForm(current => ({ ...current, hidden: false }));
  }, []);

  const onTimeStampChange = useCallback((timestampEnd: number) => {
    setEventForm(current => ({ ...current, timestampEnd }));
  }, []);

  const onInfoClick = useCallback(() => {
    setEventForm(current => ({
      ...current,
      wholeDayDisplay: true,
      display: false,
      eventStartTime: 0,
      eventEndTime: 15,
      timestampEnd: date.valueOf(),
    }));
  }, [date]);

  return (
    <EventFormContext.Provider value={{ eventForm, setEventForm }}>
      <div className={styles.Day} data-testid="Day">
        <Plus
          fullSize={sideBarDisplay}
          onClick={onPlusClickOpenEventForm}
          text={"اضافه کردن"}
          className={styles.Plus}
          disable={eventForm.display}
        />

        {/* event Details */}
        <Modal
          display={details.display}
          x={centerOFScreen().x}
          y={centerOFScreen().y}
          position="fixed"
          zIndex={250}
          width="448px"
          height="fit-content">
          <Details
            event={details}
            date={date}
            closeDetails={closeDetails}
            timeStamp={timeStamp}
          />
        </Modal>

        {/* contextMenu */}
        <Modal
          display={contextMenuStates.display}
          height="115px"
          width="192px"
          x={contextMenuStates.x}
          y={contextMenuStates.y}
          position="fixed"
          zIndex={140}>
          <ContextMenu
            closeContextMenu={closeContextMenu}
            timeStamp={timeStamp}
            color={eventForm.color}
            id={contextMenuStates.id}
            calId={contextMenuStates.calId}
          />
        </Modal>

        {/* Event form */}
        <Modal
          display={
            eventForm.hidden
              ? false
              : eventForm.display || eventForm.wholeDayDisplay
              ? true
              : false
          }
          getRef={getRef}
          zIndex={210}
          height="fit-content"
          width="450px"
          position="fixed"
          x={eventForm.x}
          y={eventForm.y}>
          <EventForm
            onColorChange={onColorChange}
            onCalChange={onCalChange}
            calId={eventForm.calId}
            handleAddingEvent={handleAddingEvent}
            eventEndTime={eventForm.eventEndTime}
            onEndTimeChang={onEndTimeChang}
            eventStartTime={eventForm.eventStartTime}
            setModalDisplay={closeModalEventForm}
            onStartTimeChange={onStartTimeChange}
            onHeaderMouseDown={onEventFormHeaderMouseDown}
            title={eventForm.title}
            description={eventForm.description}
            onDescriptionChange={onDescriptionChange}
            onTitleChange={onTitleChange}
            onTimeStampChange={onTimeStampChange}
            timestampEnd={eventForm.timestampEnd}
          />
        </Modal>

        <div
          className={styles.Header}
          style={{
            borderBottom: headerBottomBorderDisplay
              ? "2px solid var(--gray)"
              : undefined,
          }}>
          <div className={styles.Info} data-testid="Info" onClick={onInfoClick}>
            <div className={styles.DayDetailWrapper}>
              <span className={styles.Weekday}>{weekday}</span>
              <HoverCircle
                hover={false}
                background={isCurrentDate}
                backgroundColor={"var(--blue)"}
                width="50px"
                height="50px"
                className={`pointer`}>
                <div
                  className={`${styles.date}`}
                  style={{
                    color: !isCurrentDate ? "var(--text-secondary)" : undefined,
                  }}>
                  {day}
                </div>
              </HoverCircle>
            </div>
            <WholeDay
              events={wholeDayEvents}
              timeStamp={timeStamp}
              onBottomBorderMouseMove={onBottomBorderMouseMove}
              onBottomBorderMouseUp={onBottomBorderMouseUp}
              onEventBottomMouseDownSetIsMouseDownTrue={
                onEventBottomMouseDownSetIsMouseDownTrue
              }
              onEventClick={onEventClick}
              onEventRightClick={onEventRightClick}
              setEventForm={setEventForm}
              setIsMoved={setIsMoved}>
              <NewEvent
                position="relative"
                wholeDay={true}
                eventForm={eventForm}
                onNewEventResize={onNewEventResize}
                onNewEventMove={onNewEventMove}
                onNewEventMouseDown={onNewEventMouseDown}
                onNewEventMouseUp={onNewEventMouseUp}
              />
            </WholeDay>
          </div>
        </div>
        <main
          ref={mainRef}
          className={styles.main}
          onClick={e => {
            e.stopPropagation();
          }}
          onContextMenu={e => e.stopPropagation()}
          onScroll={e => {
            setHeaderBottomBorderDisplay(e.currentTarget.scrollTop);
          }}>
          <div className={styles.space}></div>
          <div
            className={styles.CalendarWrapper}
            data-testid="calendarWrapper"
            onClick={e => {
              onClickCreateEvent(e);
              onClick(e);
            }}>
            <div className={styles.EventsWrapper}>
              {moment().startOf("day").valueOf() ===
              date.startOf("day").valueOf() ? (
                <TimeLine y={timeLineMinutes} color="red" />
              ) : null}

              <NewEvent
                eventForm={eventForm}
                onNewEventResize={onNewEventResize}
                onNewEventMove={onNewEventMove}
                onNewEventMouseDown={onNewEventMouseDown}
                onNewEventMouseUp={onNewEventMouseUp}
              />

              {/* Event */}
              {events
                .filter(event => !event.timeStampEnd)
                .map((event, index) => (
                  <Event
                    key={index}
                    event={event}
                    timeStamp={timeStamp}
                    onBottomBorderMouseUp={onBottomBorderMouseUp}
                    onBottomBorderMouseMove={onBottomBorderMouseMove}
                    onEventBottomMouseDownSetIsMouseDownTrue={
                      onEventBottomMouseDownSetIsMouseDownTrue
                    }
                    onEventClick={onEventClick}
                    onEventRightClick={onEventRightClick}
                    setEventForm={setEventForm}
                    setIsMoved={setIsMoved}
                  />
                ))}
            </div>
            <Line
              vertical={true}
              height="100%"
              width="1"
              right="20px"
              top="-2%"
            />
            {drawCalendarLines(24)}
          </div>
        </main>
      </div>
    </EventFormContext.Provider>
  );
};

export default Day;
