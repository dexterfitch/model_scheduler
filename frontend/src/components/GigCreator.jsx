/**
 * Find Model: ranks the models who are free for a class (or one date) and lets an
 * admin book them. Classes with per-model preferences rank each model against the
 * spot they'd fill best.
 */

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Container, Card, Button, ListGroup, Badge, Spinner, Alert } from "react-bootstrap";
import api from "../services/api";
import { useDialog } from "./DialogProvider";
import { formatSkinTone, formatModelCount, calculateMatchScore, formatPreferenceSummary } from "../utils/formatters";
import { formatTime, formatDateWithWeekday, formatDateTime, availabilityCoversRequest, hasSchedulingConflict } from "../utils/time";
import StatusToast from "./StatusToast";
import { useRevealMessage } from '../utils/revealMessage';

/** A model's full name. */
const modelName = (user) => `${user?.first_name} ${user?.last_name}`;
/** Sorts dates by start time. */
const byStart = (a, b) => new Date(a.starts_at) - new Date(b.starts_at);

/** The confirmed gigs on each of the given dates. */
const groupConfirmedGigs = (confirmedGigs, requestIds) => {
  const grouped = {};
  requestIds.forEach(id => { grouped[id] = []; });
  confirmedGigs.forEach(g => {
    if (grouped[g.faculty_request.id]) grouped[g.faculty_request.id].push(g);
  });
  return grouped;
};

/**
 * The open spot a model fits best, with their score, or null when the class has no per-model
 * preferences.
 */
const bestOpenSlot = (user, slots, modelMode, isOpen) => {
  if (!slots?.length) return null;
  let bestSlot = null;
  let score = 0;
  slots.filter(isOpen).forEach(slot => {
    const slotScore = calculateMatchScore(user, { ...slot, model_mode: modelMode });
    if (bestSlot === null || slotScore > score) { bestSlot = slot.position; score = slotScore; }
  });
  return { score, bestSlot };
};

/** The Find Model page, for a whole class or one date. */
function GigCreator() {
  const { requestId } = useParams();
  const [searchParams] = useSearchParams();
  const isSeries = searchParams.get('type') === 'series';
  const navigate = useNavigate();
  const { confirm } = useDialog();

  const [series, setSeries] = useState(null);
  const [request, setRequest] = useState(null);
  const [matches, setMatches] = useState([]);
  const [bookedByRequest, setBookedByRequest] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const errorRef = useRevealMessage(error);
  const [successMsg, setSuccessMsg] = useState('');
  const [staffed, setStaffed] = useState(false);
  const [booking, setBooking] = useState(false);

  /** Finds the models free for every open date of the class, scored and ranked. */
  const loadSeriesData = useCallback(() => {
    return Promise.all([
      api.get("/request_series"),
      api.get("/art_model_availabilities"),
      api.get("/gigs")
    ]).then(([seriesRes, availRes, gigsRes]) => {
      const targetSeries = seriesRes.data.find(s => s.id === parseInt(requestId));
      setSeries(targetSeries);

      if (targetSeries) {
        const pendingRequests = (targetSeries.faculty_requests?.filter(r => r.status === 'pending') || []).sort(byStart);
        const isNudeReq = targetSeries.model_mode === "nude";

        const confirmedGigs = gigsRes.data.filter(g => g.status === 'confirmed');
        const pendingRequestIds = new Set(pendingRequests.map(r => r.id));
        const booked = groupConfirmedGigs(confirmedGigs, [...pendingRequestIds]);
        setBookedByRequest(booked);

        /** Whether the model has another booking at that time, besides this class's dates. */
        const hasConflict = (userId, reqStart, reqEnd) =>
          hasSchedulingConflict(confirmedGigs, userId, reqStart, reqEnd, g => 
            pendingRequestIds.has(g.faculty_request.id)
          );

        const availsByUser = {};
        availRes.data.forEach(avail => {
          if (avail.status !== 'active') return;
          const uid = avail.user.id;
          if (!availsByUser[uid]) availsByUser[uid] = { user: avail.user, avails: [] };
          availsByUser[uid].avails.push(avail);
        });

        const candidates = Object.values(availsByUser).map(({ user, avails }) => {
          if (isNudeReq && !user.willing_to_model_nude) return null;
          const requestsToBook = pendingRequests.filter(req =>
            !booked[req.id].some(g => g.art_model_availability.user.id === user.id)
          );
          if (requestsToBook.length === 0) return null;

          const fitsAll = requestsToBook.every(req => {
            const reqStart = new Date(req.starts_at);
            const reqEnd = new Date(req.ends_at);
            const timeMatch = avails.some(avail => availabilityCoversRequest(avail, req));
            return timeMatch && !hasConflict(user.id, reqStart, reqEnd);
          });
          if (!fitsAll) return null;

          const fit = bestOpenSlot(user, targetSeries.model_slots, targetSeries.model_mode, slot =>
            requestsToBook.some(req => !booked[req.id].some(g => g.model_slot_position === slot.position))
          );
          if (fit) return { user, avails, requestsToBook, ...fit };

          return { user, avails, requestsToBook, score: calculateMatchScore(user, targetSeries) };
        }).filter(Boolean);

        candidates.sort((a, b) => b.score - a.score);
        setMatches(candidates);
      }
      setLoading(false);
    }).catch(err => {
      console.error("Error loading series data:", err);
      setError("Failed to load request data. Please try again.");
      setLoading(false);
    });
  }, [requestId]);

  /** Finds the models free for one date, scored and ranked. */
  const loadSingleRequestData = useCallback(() => {
    return Promise.all([
      api.get("/faculty_requests"),
      api.get("/art_model_availabilities"),
      api.get("/gigs"),
      api.get("/request_series")
    ]).then(([reqRes, availRes, gigsRes, seriesRes]) => {
      const found = reqRes.data.find(r => r.id === parseInt(requestId));
      const slots = found && (seriesRes?.data || []).find(s => s.id === found.request_series_id)?.model_slots || [];
      const targetReq = found && { ...found, model_slots: slots };
      setRequest(targetReq);

      if (targetReq) {
        const reqStart = new Date(targetReq.starts_at);
        const reqEnd = new Date(targetReq.ends_at);
        const isNudeReq = targetReq.model_mode === "nude";

        const confirmedGigs = gigsRes.data.filter(g => g.status === 'confirmed');
        const booked = groupConfirmedGigs(confirmedGigs, [targetReq.id]);
        setBookedByRequest(booked);
        const bookedUserIds = new Set(booked[targetReq.id].map(g => g.art_model_availability.user.id));

        /** Whether the model has another booking during this date. */
        const hasConflict = (userId) =>
          hasSchedulingConflict(confirmedGigs, userId, reqStart, reqEnd, g => 
            g.faculty_request.id === targetReq.id
          );

        const candidates = availRes.data.filter(avail => {
          const timeMatch = availabilityCoversRequest(avail, targetReq);
          const nudityMatch = !isNudeReq || avail.user.willing_to_model_nude;
          const statusMatch = avail.status === 'active';
          const notAlreadyBooked = !bookedUserIds.has(avail.user.id);
          const noConflict = !hasConflict(avail.user.id);
          return timeMatch && nudityMatch && statusMatch && notAlreadyBooked && noConflict;
        });

        const scored = candidates.map(c => {
          const fit = bestOpenSlot(c.user, slots, targetReq.model_mode, slot =>
            !booked[targetReq.id].some(g => g.model_slot_position === slot.position)
          );
          return fit ? { ...c, ...fit } : { ...c, score: calculateMatchScore(c.user, targetReq) };
        });

        scored.sort((a, b) => b.score - a.score);
        setMatches(scored);
      }
      setLoading(false);
    }).catch(err => {
      console.error("Error loading data:", err);
      setError("Failed to load request data. Please try again.");
      setLoading(false);
    });
  }, [requestId]);

  /** Loads the class or the date, whichever this page is for. */
  const loadData = useCallback(
    () => (isSeries ? loadSeriesData() : loadSingleRequestData()),
    [isSeries, loadSeriesData, loadSingleRequestData]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  /** How many models a date still needs. */
  const openSlotsFor = (req) => Math.max((req.models_needed || 1) - (bookedByRequest[req.id]?.length || 0), 0);

  /** Books the model into every open date they're free for, after confirming. */
  const handleBook = async (model) => {
    const requestsToBook = isSeries ? model.requestsToBook : [request];
    const confirmed = await confirm({
      title: `Book ${modelName(model.user)}?`,
      message: requestsToBook.length > 1
        ? `They'll be booked for all ${requestsToBook.length} open dates of ${displayData.class_name}.`
        : `They'll be booked for ${displayData.class_name} on ${formatDateWithWeekday(requestsToBook[0].starts_at)}.`,
      confirmLabel: 'Confirm Booking'
    });
    if (!confirmed) return;

    setBooking(true);
    setError('');

    Promise.all(
      requestsToBook.map(req => {
        const availabilityId = isSeries
          ? model.avails.find(avail => availabilityCoversRequest(avail, req)).id
          : model.id;
        return api.post("/gigs", {
          gig: { faculty_request_id: req.id, art_model_availability_id: availabilityId }
        });
      })
    ).then(() => {
      const openRequests = isSeries
        ? series.faculty_requests?.filter(r => r.status === 'pending') || []
        : [request];
      const stillOpen = openRequests.some(req => {
        const bookedNow = requestsToBook.some(r => r.id === req.id) ? 1 : 0;
        return openSlotsFor(req) - bookedNow > 0;
      });

      if (stillOpen) {
        setSuccessMsg(`${modelName(model.user)} booked. This class still needs more models — pick the next one below.`);
        setLoading(true);
        loadData();
      } else {
        setSuccessMsg(isSeries && requestsToBook.length > 1
          ? `${requestsToBook.length} gigs confirmed! This class is fully staffed.`
          : 'Gig confirmed! This class is fully staffed.');
        setStaffed(true);
        setLoading(true);
        loadData();
      }
    }).catch(err => {
      console.error(err);
      const msg = err.response?.data?.errors?.join(" ");
      setError(msg || "Error creating gig. Please try again.");
      setLoading(true);
      loadData();
    }).finally(() => setBooking(false));
  };

  if (loading) return (
    <Container className="p-5 text-center">
      <Spinner animation="border" />
    </Container>
  );

  if (!series && !request) return (
    <Container className="p-5">
      <Alert variant="danger">Request not found.</Alert>
    </Container>
  );

  const displayData = isSeries ? series : request;
  const pendingRequests = isSeries
    ? (series.faculty_requests?.filter(r => r.status === 'pending') || []).sort(byStart)
    : (request.status === 'pending' ? [request] : []);
  const modelsNeeded = displayData.models_needed || 1;
  const isMultiModel = modelsNeeded > 1;
  const isNude = displayData.model_mode === 'nude';

  return (
    <Container className="py-4" style={{ maxWidth: '800px' }}>
      {error && (
        <Alert ref={errorRef} tabIndex={-1} variant="danger" dismissible onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      <StatusToast message={successMsg} onClose={() => setSuccessMsg('')}>
        {staffed && (
          <Button size="sm" variant="outline-dark" onClick={() => navigate('/requests')}>Back to Requests</Button>
        )}
      </StatusToast>

      <Button variant="outline-secondary" className="mb-3" onClick={() => navigate(-1)}>
        <i className="bi bi-arrow-left me-1"></i> Back
      </Button>

      <h2 className="mb-4">Book a Model</h2>

      <Card className="mb-4 border-primary shadow-sm">
        <Card.Header className="bg-primary text-white">
          Target Class
          {isSeries && pendingRequests.length > 1 && (
            <Badge bg="light" text="dark" className="ms-2">{pendingRequests.length} dates</Badge>
          )}
          {isMultiModel && (
            <Badge bg="light" text="dark" className="ms-2">{formatModelCount(modelsNeeded)} per session</Badge>
          )}
        </Card.Header>
        
        <Card.Body>
          <h3>{displayData.class_name}</h3>
          <div className="text-muted mb-2">
            <i className="bi bi-person me-1"></i>
            {isSeries
              ? `${series?.user?.first_name} ${series?.user?.last_name}`
              : `${request?.user?.first_name} ${request?.user?.last_name}`}
          </div>
          <div className="mb-2">
            {pendingRequests.map((req) => {
              const booked = bookedByRequest[req.id] || [];
              return (
                <div key={req.id} className="small">
                  <i className="bi bi-calendar3 me-1"></i>
                  {formatDateWithWeekday(req.starts_at)} &nbsp; {formatTime(req.starts_at)} - {formatTime(req.ends_at)}
                  {isMultiModel && (
                    <span className="text-muted ms-2">
                      ({booked.length}/{req.models_needed} booked{booked.length > 0 && `: ${booked.map(g =>
                        `${modelName(g.art_model_availability.user)}${g.model_slot_position ? ` (Model ${g.model_slot_position})` : ''}`
                      ).join(", ")}`})
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          {(displayData.building || displayData.room_number) && (
            <div className="text-muted small mb-2">
              <i className="bi bi-door-open me-1"></i>
              {displayData.building}{displayData.building && displayData.room_number && " "}{displayData.room_number}
            </div>
          )}
          <div className="d-flex flex-wrap gap-2">
            {isNude
              ? <Badge bg="danger">Nude Required</Badge>
              : <Badge bg="success">Clothed</Badge>}
            {!(displayData.model_slots?.length > 0) && (
              <Badge bg="info" text="dark">
                Pref: {formatPreferenceSummary(displayData, displayData.model_mode)}
              </Badge>
            )}
          </div>
          {displayData.model_slots?.length > 0 && (
            <ul className="list-unstyled small mt-2 mb-0">
              {displayData.model_slots.map(slot => (
                <li key={slot.position}>
                  <strong>Model {slot.position}:</strong> {formatPreferenceSummary(slot, displayData.model_mode)}
                </li>
              ))}
            </ul>
          )}
          {displayData.notes && (
            <div className="small text-muted fst-italic mt-2">
              <i className="bi bi-journal-text me-1"></i>{displayData.notes}
            </div>
          )}
        </Card.Body>
      </Card>

      {pendingRequests.length === 0 ? (
        <Alert variant="success">
          Every date in this request is fully staffed.
        </Alert>
      ) : (
        <>
          {isSeries && (
            <Alert variant="info" className="mb-3">
              <i className="bi bi-info-circle-fill me-2"></i>
              Only models available for <strong>all {pendingRequests.length} open dates</strong> are shown below.
              {isMultiModel && " Models already booked on some dates only need to cover the rest."}
            </Alert>
          )}

          <h4 className="text-secondary mb-3">Available Models ({matches.length})</h4>
          <ListGroup>
            {matches.length === 0 ? (
              <Alert variant="warning">
                No other models are available for all open dates and meet the nudity requirement.
              </Alert>
            ) : (
              matches.map(model => {
                const dateCount = isSeries ? model.requestsToBook.length : 1;
                return (
                  <ListGroup.Item
                    key={isSeries ? model.user.id : model.id}
                    className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 p-3"
                  >
                    <div>
                      <h5 className="mb-1">
                        {modelName(model.user)}
                        {model.score > 0 && <Badge bg="warning" text="dark" className="ms-2">★ Good Fit</Badge>}
                      </h5>
                      {model.bestSlot && model.score > 0 && (
                        <div className="small fw-bold">Best fit: Model {model.bestSlot}</div>
                      )}
                      <div className="text-muted small">
                        {formatSkinTone(model.user.skin_tone)} / {model.user.gender_identity}
                        {model.user.body_type && ` / ${model.user.body_type}`}
                        {isNude && model.user.genitalia && ` / ${model.user.genitalia}`}
                      </div>
                      {!isSeries && (
                        <div className="text-success small">
                          Available: {formatDateTime(model.starts_at)} - {formatDateTime(model.ends_at)}
                        </div>
                      )}
                    </div>
                    <Button variant="success" disabled={booking} onClick={() => handleBook(model)}>
                      {dateCount > 1 ? `Book for ${dateCount} Dates` : 'Book Model'}
                    </Button>
                  </ListGroup.Item>
                );
              })
            )}
          </ListGroup>
        </>
      )}
    </Container>
  );
}

export default GigCreator;
