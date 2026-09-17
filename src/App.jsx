import { useRef, useState } from 'react'
import { supabase } from '../supabaseClient.js'

const initialForm = {
  submission_type: 'event',
  organization_name: '',
  title: '',
  description: '',
  start_date: '',
  end_date: '',
  start_time: '',
  end_time: '',
  location_name: '',
  location_address: '',
  public_contact_name: '',
  public_contact_email: '',
  public_contact_phone: '',
  website_url: '',
  submitter_name: '',
  submitter_email: '',
  photo_credit: '',
  permission_to_publish: false,
}

function emptyToNull(value) {
  const trimmedValue = value.trim()
  return trimmedValue === '' ? null : trimmedValue
}

function App() {
  const [form, setForm] = useState(initialForm)
  const [photos, setPhotos] = useState([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const photoInputRef = useRef(null)

  const isEvent = form.submission_type === 'event'

  function handleChange(event) {
    const { name, value, type, checked } = event.target

    setForm((currentForm) => ({
      ...currentForm,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  function handlePhotoChange(event) {
    const selectedPhotos = Array.from(event.target.files)
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
    ]
    const maximumFileSize = 6 * 1024 * 1024

    setMessage('')

    if (selectedPhotos.length > 3) {
      setPhotos([])
      event.target.value = ''
      setMessage('Please select no more than three photos.')
      return
    }

    const invalidType = selectedPhotos.find(
      (photo) => !allowedTypes.includes(photo.type),
    )

    if (invalidType) {
      setPhotos([])
      event.target.value = ''
      setMessage('Photos must be JPG, PNG, WebP, or GIF files.')
      return
    }

    const oversizedPhoto = selectedPhotos.find(
      (photo) => photo.size > maximumFileSize,
    )

    if (oversizedPhoto) {
      setPhotos([])
      event.target.value = ''
      setMessage('Each photo must be 6 MB or smaller.')
      return
    }

    setPhotos(selectedPhotos)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setMessage('')

    if (photos.length > 3) {
      setMessage('Please select no more than three photos.')
      return
    }

    setIsSubmitting(true)

    const submissionId = crypto.randomUUID()
    const uploadedPhotoPaths = []

    try {
      for (const photo of photos) {
        const extension =
          photo.name.split('.').pop()?.toLowerCase() || 'jpg'

        const photoPath =
          `${submissionId}/${crypto.randomUUID()}.${extension}`

        const { error: uploadError } = await supabase.storage
          .from('october-submission-photos')
          .upload(photoPath, photo, {
            cacheControl: '3600',
            contentType: photo.type,
            upsert: false,
          })

        if (uploadError) {
          throw uploadError
        }

        uploadedPhotoPaths.push(photoPath)
      }

      const submission = {
        id: submissionId,
        submission_type: form.submission_type,
        organization_name: emptyToNull(form.organization_name),
        title: form.title.trim(),
        description: form.description.trim(),

        start_date: isEvent
          ? emptyToNull(form.start_date)
          : null,

        end_date: isEvent
          ? emptyToNull(form.end_date)
          : null,

        start_time: isEvent
          ? emptyToNull(form.start_time)
          : null,

        end_time: isEvent
          ? emptyToNull(form.end_time)
          : null,

        location_name: isEvent
          ? emptyToNull(form.location_name)
          : null,

        location_address: isEvent
          ? emptyToNull(form.location_address)
          : null,

        public_contact_name: emptyToNull(
          form.public_contact_name,
        ),

        public_contact_email: emptyToNull(
          form.public_contact_email,
        ),

        public_contact_phone: emptyToNull(
          form.public_contact_phone,
        ),

        website_url: emptyToNull(form.website_url),
        submitter_name: form.submitter_name.trim(),
        submitter_email: form.submitter_email.trim(),

        photo_credit:
          photos.length > 0
            ? emptyToNull(form.photo_credit)
            : null,

        photo_paths: uploadedPhotoPaths,
        permission_to_publish: form.permission_to_publish,
      }

      const { error: submissionError } = await supabase
        .from('october_submissions')
        .insert(submission)

      if (submissionError) {
        throw submissionError
      }

      setForm(initialForm)
      setPhotos([])

      if (photoInputRef.current) {
        photoInputRef.current.value = ''
      }

      setMessage(
        'Thank you! Your submission was sent to the Indian Valley Chamber of Commerce.',
      )
    } catch (error) {
      console.error(error)

      setMessage(
        'Your submission could not be sent. Please try again or contact the Chamber.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main>
      <h1>Indian Valley October Events & News</h1>

      <p>
        Submit an October event, community announcement, or news
        item for consideration by the Indian Valley Chamber of
        Commerce.
      </p>

      <form onSubmit={handleSubmit}>
        <fieldset>
          <legend>1. Submission Type</legend>

          <label>
            <input
              type="radio"
              name="submission_type"
              value="event"
              checked={form.submission_type === 'event'}
              onChange={handleChange}
            />
            Event
          </label>

          <br />

          <label>
            <input
              type="radio"
              name="submission_type"
              value="news"
              checked={form.submission_type === 'news'}
              onChange={handleChange}
            />
            News or community announcement
          </label>
        </fieldset>

        <fieldset>
          <legend>2. Main Information</legend>

          <label htmlFor="organization_name">
            Business or organization name
          </label>

          <br />

          <input
            id="organization_name"
            name="organization_name"
            type="text"
            value={form.organization_name}
            onChange={handleChange}
          />

          <br />
          <br />

          <label htmlFor="title">
            Submission title
          </label>

          <br />

          <input
            id="title"
            name="title"
            type="text"
            required
            value={form.title}
            onChange={handleChange}
          />

          <br />
          <br />

          <label htmlFor="description">
            Description
          </label>

          <br />

          <textarea
            id="description"
            name="description"
            rows="8"
            required
            value={form.description}
            onChange={handleChange}
          />
        </fieldset>

        {isEvent && (
          <fieldset>
            <legend>3. Event Details</legend>

            <label htmlFor="start_date">
              Event date
            </label>

            <br />

            <input
              id="start_date"
              name="start_date"
              type="date"
              min="2026-10-01"
              max="2026-10-31"
              required
              value={form.start_date}
              onChange={handleChange}
            />

            <br />
            <br />

            <label htmlFor="end_date">
              End date, if this is a multi-day event
            </label>

            <br />

            <input
              id="end_date"
              name="end_date"
              type="date"
              min={form.start_date || '2026-10-01'}
              max="2026-10-31"
              value={form.end_date}
              onChange={handleChange}
            />

            <br />
            <br />

            <label htmlFor="start_time">
              Start time
            </label>

            <br />

            <input
              id="start_time"
              name="start_time"
              type="time"
              value={form.start_time}
              onChange={handleChange}
            />

            <br />
            <br />

            <label htmlFor="end_time">
              End time
            </label>

            <br />

            <input
              id="end_time"
              name="end_time"
              type="time"
              value={form.end_time}
              onChange={handleChange}
            />

            <br />
            <br />

            <label htmlFor="location_name">
              Location name
            </label>

            <br />

            <input
              id="location_name"
              name="location_name"
              type="text"
              required
              value={form.location_name}
              onChange={handleChange}
            />

            <br />
            <br />

            <label htmlFor="location_address">
              Location address
            </label>

            <br />

            <input
              id="location_address"
              name="location_address"
              type="text"
              value={form.location_address}
              onChange={handleChange}
            />
          </fieldset>
        )}

        <fieldset>
          <legend>
            {isEvent ? '4' : '3'}. Public Contact and Links
          </legend>

          <p>
            Enter only the contact information that may be shared
            publicly with the submission.
          </p>

          <label htmlFor="public_contact_name">
            Public contact name
          </label>

          <br />

          <input
            id="public_contact_name"
            name="public_contact_name"
            type="text"
            value={form.public_contact_name}
            onChange={handleChange}
          />

          <br />
          <br />

          <label htmlFor="public_contact_email">
            Public contact email
          </label>

          <br />

          <input
            id="public_contact_email"
            name="public_contact_email"
            type="email"
            value={form.public_contact_email}
            onChange={handleChange}
          />

          <br />
          <br />

          <label htmlFor="public_contact_phone">
            Public contact phone
          </label>

          <br />

          <input
            id="public_contact_phone"
            name="public_contact_phone"
            type="tel"
            value={form.public_contact_phone}
            onChange={handleChange}
          />

          <br />
          <br />

          <label htmlFor="website_url">
            Website or additional-information link
          </label>

          <br />

          <input
            id="website_url"
            name="website_url"
            type="url"
            placeholder="https://"
            value={form.website_url}
            onChange={handleChange}
          />
        </fieldset>

        <fieldset>
          <legend>
            {isEvent ? '5' : '4'}. Optional Photos
          </legend>

          <p>
            You may upload one to three photos. Each photo must be
            6 MB or smaller.
          </p>

          <label htmlFor="photos">
            Select photos
          </label>

          <br />

          <input
            ref={photoInputRef}
            id="photos"
            name="photos"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            onChange={handlePhotoChange}
          />

          {photos.length > 0 && (
            <>
              <p>
                {photos.length} photo
                {photos.length === 1 ? '' : 's'} selected
              </p>

              <label htmlFor="photo_credit">
                Photo credit, if applicable
              </label>

              <br />

              <input
                id="photo_credit"
                name="photo_credit"
                type="text"
                value={form.photo_credit}
                onChange={handleChange}
              />
            </>
          )}
        </fieldset>

        <fieldset>
          <legend>
            {isEvent ? '6' : '5'}. Submitter Information
          </legend>

          <p>
            This information is for Chamber follow-up and will not
            be included in the public listing.
          </p>

          <label htmlFor="submitter_name">
            Your name
          </label>

          <br />

          <input
            id="submitter_name"
            name="submitter_name"
            type="text"
            required
            value={form.submitter_name}
            onChange={handleChange}
          />

          <br />
          <br />

          <label htmlFor="submitter_email">
            Your email
          </label>

          <br />

          <input
            id="submitter_email"
            name="submitter_email"
            type="email"
            required
            value={form.submitter_email}
            onChange={handleChange}
          />
        </fieldset>

        <fieldset>
          <legend>
            {isEvent ? '7' : '6'}. Permission
          </legend>

          <label>
            <input
              type="checkbox"
              name="permission_to_publish"
              required
              checked={form.permission_to_publish}
              onChange={handleChange}
            />
            I confirm that the submitted information is accurate
            and that I have permission to provide this content and
            any uploaded photos to the Indian Valley Chamber of
            Commerce for publication and promotional use.
          </label>
        </fieldset>

        <br />

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Submitting…' : 'Submit'}
        </button>

        {message && (
          <p role="status">
            {message}
          </p>
        )}
      </form>
    </main>
  )
}

export default App