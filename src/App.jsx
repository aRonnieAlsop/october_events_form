import { useRef, useState } from 'react'
import { supabase } from '../supabaseClient'
import logo from './assets/logo.png'
import './App.css'

const membershipUrl =
  'https://www.zeffy.com/en-US/ticketing/indian-valley-chamber-of-commerces-memberships'

const maximumPhotoCount = 3
const maximumFileSize = 6 * 1024 * 1024

const allowedPhotoTypes = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]

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
  membership_status: '',
  photo_credit: '',
  permission_to_publish: false,
}

function emptyToNull(value) {
  const trimmedValue = value.trim()
  return trimmedValue === '' ? null : trimmedValue
}

function getPhotoIdentifier(photo) {
  return `${photo.name}-${photo.size}-${photo.lastModified}`
}

function App() {
  const [form, setForm] = useState(initialForm)
  const [photos, setPhotos] = useState([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [showSuccess, setShowSuccess] = useState(false)
  const photoInputRef = useRef(null)

  const isEvent = form.submission_type === 'event'
  const isNonmember = form.membership_status === 'not_member'

  function handleChange(event) {
    const { name, value, type, checked } = event.target

    setForm((currentForm) => ({
      ...currentForm,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  function handlePhotoChange(event) {
    const newlySelectedPhotos = Array.from(event.target.files)

    setMessage('')

    if (newlySelectedPhotos.length === 0) {
      return
    }

    const invalidType = newlySelectedPhotos.find(
      (photo) => !allowedPhotoTypes.includes(photo.type),
    )

    if (invalidType) {
      event.target.value = ''

      setMessage(
        `${invalidType.name} is not an accepted image type. Please use JPG, PNG, WebP, or GIF files.`,
      )

      return
    }

    const oversizedPhoto = newlySelectedPhotos.find(
      (photo) => photo.size > maximumFileSize,
    )

    if (oversizedPhoto) {
      event.target.value = ''

      setMessage(
        `${oversizedPhoto.name} is larger than 6 MB. Please choose a smaller image.`,
      )

      return
    }

    const existingPhotoIdentifiers = new Set(
      photos.map(getPhotoIdentifier),
    )

    const uniqueNewPhotos = newlySelectedPhotos.filter(
      (photo) =>
        !existingPhotoIdentifiers.has(
          getPhotoIdentifier(photo),
        ),
    )

    if (
      photos.length + uniqueNewPhotos.length >
      maximumPhotoCount
    ) {
      const remainingPhotoCount =
        maximumPhotoCount - photos.length

      event.target.value = ''

      setMessage(
        remainingPhotoCount > 0
          ? `You may add ${remainingPhotoCount} more photo${
              remainingPhotoCount === 1 ? '' : 's'
            }.`
          : 'You already have three photos selected.',
      )

      return
    }

    setPhotos((currentPhotos) => [
      ...currentPhotos,
      ...uniqueNewPhotos,
    ])

    /*
      Clear the browser input after adding the files to React state.
      This lets someone reopen the picker and add another photo
      without replacing the photos already selected.
    */
    event.target.value = ''
  }

  function removePhoto(photoToRemove) {
    setPhotos((currentPhotos) =>
      currentPhotos.filter(
        (photo) =>
          getPhotoIdentifier(photo) !==
          getPhotoIdentifier(photoToRemove),
      ),
    )

    setMessage('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setMessage('')
    setShowSuccess(false)

    if (photos.length > maximumPhotoCount) {
      setMessage('Please select no more than three photos.')
      return
    }

    if (!form.membership_status) {
      setMessage(
        'Please indicate whether you are a current Chamber member.',
      )

      return
    }

    setIsSubmitting(true)

    const submissionId = crypto.randomUUID()
    const uploadedPhotoPaths = []

    try {
      /*
        Upload every queued photo before inserting the completed
        submission. All photos are stored inside a folder named
        with this submission's unique ID.
      */
      for (const photo of photos) {
        const extension =
          photo.name.split('.').pop()?.toLowerCase() || 'jpg'

        const photoPath =
          `${submissionId}/${crypto.randomUUID()}.${extension}`

        const { data: uploadedPhoto, error: uploadError } =
          await supabase.storage
            .from('october-submission-photos')
            .upload(photoPath, photo, {
              cacheControl: '3600',
              contentType: photo.type,
              upsert: false,
            })

        if (uploadError) {
          throw new Error(
            `Photo upload failed: ${uploadError.message}`,
          )
        }

        uploadedPhotoPaths.push(uploadedPhoto.path)
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
        membership_status: form.membership_status,

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
        throw new Error(
          `Submission failed: ${submissionError.message}`,
        )
      }

      setForm(initialForm)
      setPhotos([])

      if (photoInputRef.current) {
        photoInputRef.current.value = ''
      }

      setShowSuccess(true)
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
    <>
      <a
        className="ivcc-home-link"
        href="https://indianvalleychamber.org/"
        aria-label="Return to the Indian Valley Chamber of Commerce home page"
      >
        <img
          src={logo}
          alt="Indian Valley Chamber of Commerce"
        />

        <span>IVCC Home</span>
      </a>

      <main>
        <h1>Indian Valley October Events &amp; News</h1>

        <p>
          Submit an October event, community announcement, or news
          item for consideration by the Indian Valley Chamber of
          Commerce.
        </p>

        <form onSubmit={handleSubmit}>
          <fieldset className="submission-type">
            <legend>1. Submission Type</legend>

            <div className="submission-options">
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
            </div>
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
              You may add one to three photos. Select them together
              or add them one at a time. Each photo must be 6 MB or
              smaller.
            </p>

            <label htmlFor="photos">
              Add photos
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
              <div className="selected-photos">
                <p className="selected-photos-heading">
                  {photos.length} of {maximumPhotoCount} photos
                  ready to upload with your submission:
                </p>

                <ul className="selected-photo-list">
                  {photos.map((photo) => (
                    <li key={getPhotoIdentifier(photo)}>
                      <span>{photo.name}</span>

                      <button
                        type="button"
                        className="remove-photo"
                        onClick={() => removePhoto(photo)}
                        aria-label={`Remove ${photo.name}`}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
<label htmlFor="photo_credit">
  Photo credit(s), if applicable
</label>

<br />

<input
  id="photo_credit"
  name="photo_credit"
  type="text"
  placeholder="Example: Photos 1–2: Jane Smith; Photo 3: John Doe"
  value={form.photo_credit}
  onChange={handleChange}
/>
              </div>
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

            <div className="membership-question">
              <p className="membership-heading">
                Are you a current Indian Valley Chamber of Commerce
                member?
              </p>

              <div className="membership-options">
                <label>
                  <input
                    type="radio"
                    name="membership_status"
                    value="member"
                    required
                    checked={form.membership_status === 'member'}
                    onChange={handleChange}
                  />
                  Yes
                </label>

                <label>
                  <input
                    type="radio"
                    name="membership_status"
                    value="not_member"
                    required
                    checked={
                      form.membership_status === 'not_member'
                    }
                    onChange={handleChange}
                  />
                  No
                </label>
              </div>

              {isNonmember && (
                <div className="nonmember-information">
                  <p>
                    Current Chamber members receive priority
                    consideration for Chamber promotional space.
                    Nonmembers are still welcome to submit, and
                    inclusion is subject to available space and
                    Chamber review.
                  </p>

                  <p>
                    Chamber memberships are renewed annually. If you
                    would like to join,{' '}
                    <a
                      href={membershipUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      view the membership options
                    </a>
                    .
                  </p>

                  <p className="zeffy-note">
                    *Zeffy may suggest an optional contribution to
                    support its platform. To decline, select
                    “Other” and enter $0. This contribution is
                    separate from your Chamber membership dues.
                  </p>
                </div>
              )}
            </div>
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

          <p className="questions-contact">
            <span className="questions-label">
              Questions?
            </span>

            <a
              href="mailto:chamberofcommerceiv@gmail.com"
              title="chamberofcommerceiv@gmail.com"
            >
              <span className="email-action">
                <span aria-hidden="true">✉</span>
                Email us
              </span>

              <span className="email-address">
                chamberofcommerceiv@gmail.com
              </span>
            </a>
          </p>
        </form>
      </main>

      {showSuccess && (
        <div
          className="success-overlay"
          role="presentation"
          onClick={() => setShowSuccess(false)}
        >
          <section
            className="success-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="success-title"
            aria-describedby="success-description"
            onClick={(event) => event.stopPropagation()}
          >
            <div
              className="success-envelope"
              aria-hidden="true"
            >
              ✉
            </div>

            <h2 id="success-title">
              Submission Received
            </h2>

            <p id="success-description">
              Thank you! Your submission was sent to the Indian
              Valley Chamber of Commerce for review.
            </p>

            <button
              type="button"
              className="success-close"
              onClick={() => setShowSuccess(false)}
              autoFocus
            >
              Close
            </button>
          </section>
        </div>
      )}
    </>
  )
}

export default App