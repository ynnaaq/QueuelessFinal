import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import express from 'express'
import mongoose from 'mongoose'
import cors from 'cors'
import User from './models/User.js'
import Office from './models/Office.js'
import Ticket from './models/Ticket.js'
import Session from './models/Session.js'
import Feedback from './models/Feedback.js'
import Schedule from './models/Schedule.js'
import PromotionInvitation from './models/PromotionInvitation.js'
import AuditLog from './models/AuditLog.js'
import { sendEmailOtp } from './emailService.js'


const activeStatuses = [
  'waiting',
  'serving',
  'skipped',
]

const sessionLifetimeMs =
  5 * 60 * 1000

const passwordResetLifetimeMs =
  10 * 60 * 1000

const emailVerificationLifetimeMs =
  10 * 60 * 1000


const today = () =>
  new Intl.DateTimeFormat(
    'en-CA',
    {
      timeZone: 'Asia/Manila',
    }
  ).format(new Date())


const fail = (
  message,
  status = 400
) => {
  throw Object.assign(
    new Error(message),
    {
      status,
    }
  )
}

const app = express()

app.use(
  cors({
    origin: process.env.FRONTEND_URL,
  })
)


const text = (
  value,
  label,
  max = 200
) => {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.length > max
  ) {
    fail(
      `${label} is required (maximum ${max} characters).`
    )
  }

  return value.trim()
}


const emailValue = (value) => {
  const email =
    text(
      value,
      'Email'
    ).toLowerCase()

  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      email
    )
  ) {
    fail(
      'Enter a valid email address.'
    )
  }

  return email
}


const nameValue = (value) => {
  const name = text(value, 'Full name', 120)

  // Allows:
  // letters
  // spaces
  // commas
  // apostrophes
  // hyphens
  // periods
  if (!/^[\p{L}][\p{L}' ,.-]*$/u.test(name)) {
    fail(
      'Full name can contain letters, spaces, commas, apostrophes, periods, and hyphens only.'
    )
  }

  return name
}

const normalizeNamePart = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z]/g, '')
    .toLowerCase()


const parseStudentName = (fullName) => {
  const name = nameValue(fullName)

  if (name.includes(',')) {
    const parts = name
      .split(',')
      .map(part => part.trim())
      .filter(Boolean)

    if (parts.length === 3) {
      return {
        lastName: parts[0],
        firstName: parts[1],
        middleName: parts[2],
      }
    }

    if (parts.length === 2) {
      const rightSide = parts[1]
        .split(/\s+/)
        .filter(Boolean)

      if (rightSide.length >= 2) {
        return {
          lastName: parts[0],
          firstName: rightSide[0],
          middleName: rightSide
            .slice(1)
            .join(' '),
        }
      }
    }
  }

  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (parts.length >= 3) {
    return {
      firstName: parts[0],
      middleName: parts
        .slice(1, -1)
        .join(' '),
      lastName: parts[parts.length - 1],
    }
  }

  fail(
    'Enter your complete first name, middle name, and last name.'
  )
}


const expectedPhinmaEmail = (fullName) => {
  const {
    firstName,
    middleName,
    lastName,
  } = parseStudentName(fullName)

  const firstTwo =
    normalizeNamePart(firstName)
      .slice(0, 2)

  const middleTwo =
    normalizeNamePart(middleName)
      .slice(0, 2)

  const last =
    normalizeNamePart(lastName)

  if (
    firstTwo.length < 2 ||
    middleTwo.length < 2 ||
    !last
  ) {
    fail(
      'Unable to determine the PHINMA email from the entered name.'
    )
  }

  return `${firstTwo}${middleTwo}.${last}.up@phinmaed.com`
}

const scheduleValue = (value) => {
  if (
    !Array.isArray(value) ||
    value.length > 21
  ) {
    fail(
      'Schedule must contain up to 21 shifts.'
    )
  }

  const days = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ]

  return value.map((shift) => {
    if (
      !shift ||
      !days.includes(shift.day) ||
      !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(
        shift.start
      ) ||
      !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(
        shift.end
      ) ||
      shift.start >= shift.end
    ) {
      fail(
        'Each shift needs a valid day, start time, and end time.'
      )
    }

    return {
      day: shift.day,
      start: shift.start,
      end: shift.end,
    }
  })
}


const passwordValue = (value) => {
  if (
    typeof value !== 'string' ||
    value.length < 8 ||
    value.length > 128 ||
    /\s/.test(value) ||
    !/[A-Z]/.test(value) ||
    !/[a-z]/.test(value) ||
    !/\d/.test(value) ||
    !/[!@#$%^&*]/.test(value)
  ) {
    fail(
      'Password must be 8–128 characters, with uppercase, lowercase, number, and ! @ # $ % ^ & *; spaces are not allowed.'
    )
  }

  return value
}


const hash = (password) => {
  const salt =
    crypto
      .randomBytes(16)
      .toString('hex')

  return `${salt}:${crypto
    .scryptSync(
      password,
      salt,
      64
    )
    .toString('hex')}`
}


const verify = (
  password,
  encoded
) => {
  if (
    typeof password !== 'string' ||
    typeof encoded !== 'string'
  ) {
    return false
  }

  const [
    salt,
    digestHex,
  ] = encoded.split(':')

  if (
    !salt ||
    !digestHex
  ) {
    return false
  }

  try {
    const a =
      Buffer.from(
        digestHex,
        'hex'
      )

    const b =
      crypto.scryptSync(
        password,
        salt,
        64
      )

    return (
      a.length === b.length &&
      crypto.timingSafeEqual(
        a,
        b
      )
    )
  } catch {
    return false
  }
}


const digest = (token) =>
  crypto
    .createHash('sha256')
    .update(token)
    .digest('hex')


const publicUser = (user) => {
  const raw =
    user?.toObject
      ? user.toObject()
      : {
          ...user,
        }

  delete raw.passwordHash
  delete raw.emailVerificationCodeHash
  delete raw.emailVerificationExpiresAt
  delete raw.emailVerificationAttempts
  delete raw.resetPasswordTokenHash
  delete raw.resetPasswordExpiresAt
  delete raw.resetPasswordAttempts

  const id = String(
    raw._id ||
    raw.id
  )

  return {
    ...raw,
    id,
    _id: id,
    roles: Array.from(new Set([...(raw.roles || []), raw.role])),
  }
}


const officeDefinitions = [
  {
    slug: 'reg',
    name: 'Registrar',
    code: 'R',
    wait: 4,

    services: [
      [
        'Transcript / school records',
        [
          'Valid school ID',
          'Completed request form',
          'Authorization letter if requesting for another person',
        ],
      ],

      [
        'Certificate request',
        [
          'Valid school ID',
          'Completed request form',
        ],
      ],

      [
        'Enrollment concern',
        [
          'Valid school ID',
          'Enrollment or registration documents',
        ],
      ],
    ],
  },

  {
    slug: 'fin',
    name: 'Finance',
    code: 'F',
    wait: 6,

    services: [
      [
        'Tuition / school fees',
        [
          'Valid school ID',
          'Payment or reference document',
        ],
      ],

      [
        'Official receipt request',
        [
          'Valid school ID',
          'Payment reference',
        ],
      ],

      [
        'Account assessment',
        [
          'Valid school ID',
          'Assessment form when applicable',
        ],
      ],
    ],
  },

  {
    slug: 'csdl',
    name: 'CSDL',
    code: 'C',
    wait: 5,

    services: [
      [
        'Student clearance',
        [
          'Valid school ID',
          'Relevant clearance form',
        ],
      ],

      [
        'ID concern',
        [
          'Valid school ID',
          'Relevant concern form',
        ],
      ],

      [
        'General student concern',
        [
          'Valid school ID',
          'Relevant supporting documents',
        ],
      ],
    ],
  },

  {
    slug: 'lib',
    name: 'Library',
    code: 'L',
    wait: 3,

    services: [
      [
        'Library clearance',
        [
          'Valid school ID',
          'Relevant clearance form',
        ],
      ],

      [
        'Borrowing / return concern',
        [
          'Valid school ID',
          'Borrowed item information',
        ],
      ],

      [
        'Account verification',
        [
          'Valid school ID',
          'Relevant supporting documents',
        ],
      ],
    ],
  },

  {
    slug: 'mkt',
    name: 'Marketing',
    code: 'M',
    wait: 4,

    services: [
      ['Marketing inquiry', ['Valid school ID', 'Relevant request details']],
      ['Sponsorship / partnership request', ['Valid school ID', 'Request letter or proposal']],
      ['Branding material request', ['Valid school ID', 'Completed request form']],
    ],
  },

  {
    slug: 'book',
    name: 'Bookstore',
    code: 'B',
    wait: 3,

    services: [
      ['Textbook purchase inquiry', ['Valid school ID', 'Course or subject details']],
      ['School supplies purchase', ['Valid school ID']],
      ['Bookstore order concern', ['Valid school ID', 'Order or receipt details']],
    ],
  },
]


async function seedOffices() {
  for (
    const definition
    of officeDefinitions
  ) {
    const services =
      definition.services.map(
        (
          [
            name,
            requirements,
          ]
        ) => ({
          name,
          requirements,
        })
      )

    await Office.updateOne(
      {
        slug:
          definition.slug,
      },
      {
        $setOnInsert: {
          slug:
            definition.slug,

          name:
            definition.name,

          code:
            definition.code,

          wait:
            definition.wait,

          open: true,

          sequence: 0,

          hours:
            '8:00 AM - 5:00 PM',

          services,
        },
      },
      {
        upsert: true,
      }
    )
  }
}


async function seedAdmin(
  adminEmail,
  adminPassword,
  seedDemo
) {
  if (
    adminEmail &&
    adminPassword
  ) {
    const email =
      emailValue(
        adminEmail
      )

    await User.findOneAndUpdate(
      {
        email,
      },
      {
        $set: {
          name:
            'School Admin',

          email,

          passwordHash:
            hash(
              adminPassword
            ),

          role:
            'admin',

          status:
            'Active',

          emailVerified: true,
        },
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
      }
    )
  }


  if (seedDemo) {
    const demos = [
      {
        name:
          'Maria Santos',

        email:
          'maria@student.edu',

        password:
          'Student123!',

        role:
          'student',

        accountId:
          '03-3456-789012',

        department:
          'CITE',

        yearLevel:
          'First year',

        semester:
          '1st semester',
      },

      {
        name:
          'Ana Reyes',

        email:
          'staff@school.edu',

        password:
          'Staff123!',

        role:
          'staff',

        office:
          'Registrar',
      },

      {
        name:
          'School Admin',

        email:
          'admin@school.edu',

        password:
          'Admin123!',

        role:
          'admin',
      },
    ]


    for (
      const demo
      of demos
    ) {
      const {
        password,
        ...data
      } = demo

      await User.updateOne(
        {
          email:
            demo.email,
        },
        {
          $setOnInsert: {
            ...data,

            passwordHash:
              hash(
                password
              ),

            status:
              'Active',

            emailVerified: true,
          },
        },
        {
          upsert: true,
        }
      )
    }
  }
}


async function findOffice(
  idOrName
) {
  if (!idOrName) {
    fail(
      'Office not found.',
      404
    )
  }

  const value =
    String(idOrName)

  const escaped =
    value.replace(
      /[.*+?^${}()|[\]\\]/g,
      '\\$&'
    )

  const clauses = [
    {
      slug:
        value.toLowerCase(),
    },

    {
      name:
        new RegExp(
          `^${escaped}$`,
          'i'
        ),
    },
  ]


  if (
    mongoose.isValidObjectId(
      value
    )
  ) {
    clauses.push({
      _id: value,
    })
  }


  const office =
    await Office.findOne({
      $or: clauses,
    })


  if (!office) {
    fail(
      'Office not found.',
      404
    )
  }


  return office
}


async function createSession(
  user
) {
  const token =
    crypto
      .randomBytes(32)
      .toString('hex')


  await Session.create({
    tokenHash:
      digest(token),

    userId:
      user._id,

    expiresAt:
      new Date(
        Date.now() +
        sessionLifetimeMs
      ),
  })


  return {
    token,
    user:
      publicUser(user),
  }
}


function apiOffice(
  office,
  metrics = {}
) {
  const raw =
    office.toObject
      ? office.toObject()
      : office


  return {
    ...raw,

    id:
      raw.slug ||
      String(raw._id),

    _id:
      String(raw._id),

    waiting:
      metrics.waiting ??
      0,

    serving:
      metrics.serving ??
      '',

    served:
      metrics.served ??
      0,

    avgWait:
      metrics.avgWait ??
      0,

    serviceMinutes:
      metrics.serviceMinutes ??
      raw.wait ??
      4,

    rating:
      metrics.rating ??
      0,

    completion:
      metrics.completion ??
      0,
  }
}


function apiTicket(
  ticket,
  {
    student,
    office,
    queuePosition = 0,
    feedback,
  } = {}
) {
  const raw =
    ticket.toObject
      ? ticket.toObject()
      : ticket


  return {
    ...raw,

    id:
      String(raw._id),

    _id:
      String(raw._id),

    ticket:
      raw.ticketNumber,

    studentId:
      student
        ? student.email
        : String(
            raw.studentId
          ),

    studentObjectId:
      student
        ? String(
            student._id
          )
        : String(
            raw.studentId
          ),

    officeId:
      office
        ? office.slug
        : String(
            raw.officeId
          ),

    name:
      student?.name,

    accountId:
      student?.accountId,

    queuePosition,

    feedback:
      feedback
        ? {
            rating:
              feedback.rating,

            comment:
              feedback.comment,

            createdAt:
              feedback.createdAt,
          }
        : undefined,
  }
}


export function createApp({
  seedDemo = false,
  adminEmail,
  adminPassword,
} = {}) {
  const app =
    express()

  // Use the same public project credentials as the browser when both files
  // are present. This keeps the token issuer and token validator aligned.
  // SUPABASE_* remains available for deployments that do not use Vite.
  const supabaseUrl =
    process.env.VITE_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim()
  const supabaseKey =
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.SUPABASE_PUBLISHABLE_KEY?.trim()
  const supabase =
    supabaseUrl && supabaseKey
      ? createClient(supabaseUrl, supabaseKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        })
      : null

  app.set('trust proxy', 1)

  app.disable(
    'x-powered-by'
  )


  app.use((req, res, next) => {
    res.set({
      'Content-Security-Policy': "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data:; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'",
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
    })
    if (req.secure || req.get('x-forwarded-proto') === 'https') {
      res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
    }
    next()
  })


  app.use(cors({ origin: process.env.FRONTEND_URL || false }))


  app.use(
    express.json({
      limit:
        '1mb',
    })
  )


  app.use(
    (
      req,
      res,
      next
    ) => {
      res.set(
        'Cache-Control',
        'no-store'
      )

      next()
    }
  )


  const attempts =
    new Map()

  const sensitiveAttempts = new Map()


  const sendEmailCode = sendEmailOtp

  const newOtp = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')

  app.use('/api/auth', (req, res, next) => {
    const protectedPaths = new Set(['/login', '/forgot-password', '/reset-password', '/verify-email', '/resend-verification'])
    if (req.method !== 'POST' || !protectedPaths.has(req.path)) return next()
    const key = `${req.path}:${req.ip}`
    const now = Date.now()
    const entry = sensitiveAttempts.get(key) || { count: 0, until: now + 15 * 60 * 1000 }
    if (entry.until <= now) { entry.count = 0; entry.until = now + 15 * 60 * 1000 }
    entry.count += 1
    sensitiveAttempts.set(key, entry)
    if (entry.count > 10) return res.status(429).json({ message: 'Too many attempts. Try again in 15 minutes.' })
    next()
  })


  app.use(
    '/api/auth',
    (
      req,
      res,
      next
    ) => {
      if (
        req.method !==
        'POST'
      ) {
        return next()
      }


      const key =
        req.ip


      const entry =
        attempts.get(
          key
        ) || {
          count: 0,

          until:
            Date.now() +
            60000,
        }


      if (
        entry.until <
        Date.now()
      ) {
        entry.count = 0

        entry.until =
          Date.now() +
          60000
      }


      attempts.set(
        key,
        entry
      )


      if (
        ++entry.count >
        30
      ) {
        return res
          .status(429)
          .json({
            message:
              'Too many attempts. Try again in a minute.',
          })
      }


      next()
    }
  )


  const route = (
    method,
    url,
    roles,
    handler
  ) =>
    app[method](
      url,

      async (
        req,
        res,
        next
      ) => {
        try {
          const token =
            /^Bearer (.+)$/.exec(
              req.headers
                .authorization ||
                ''
            )?.[1]


          let session =
            null

          let user =
            null


          if (token) {
            session =
              await Session.findOne(
                {
                  tokenHash:
                    digest(token),
                }
              )

            const now = new Date()

            // Sessions created before expiresAt was added to the schema did
            // not persist that field. Recover only those that are still
            // within the original seven-day lifetime.
            if (session && !session.expiresAt) {
              const legacyExpiresAt = new Date(
                session.createdAt.getTime() + sessionLifetimeMs
              )

              if (legacyExpiresAt > now) {
                session.expiresAt = legacyExpiresAt
                await session.save()
              } else {
                session = null
              }
            }

            if (session && session.expiresAt <= now) {
              session = null
            }


            if (session) {
              user =
                await User.findOne(
                  {
                    _id:
                      session.userId,

                    status:
                      'Active',
                  }
                )
            }

          }


          if (
            roles &&
            !user
          ) {
            fail(
              'Your session has expired.',
              401
            )
          }


          if (
            roles?.length &&
            !roles.includes(
              user.role
            )
          ) {
            fail(
              'You do not have permission for this action.',
              403
            )
          }


          const result =
            await handler({
              req,
              user,
              session,
              body:
                req.body ||
                {},
              token,
            })


          res
            .status(
              result?.status ||
              200
            )
            .json(
              result?.data ||
              result ||
              {
                success:
                  true,
              }
            )
        } catch (error) {
          next(error)
        }
      }
    )


  const initialize =
    async () => {
      await seedOffices()

      await seedAdmin(
        adminEmail,
        adminPassword,
        seedDemo
      )
    }

  const grantedRoles = (user) =>
    Array.from(new Set([...(user.roles || []), user.role]))


  route(
    'get',
    '/api/health',
    null,

    async () => {
      const connected = mongoose.connection.readyState === 1
      if (!connected) fail('Database is unavailable.', 503)
      return { ok: true, database: 'mongodb', status: 'connected' }
    }
  )

  route(
    'get',
    '/api/admin/audit-logs',
    ['admin'],
    async () => {
      const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(250)
      return {
        logs: logs.map(log => ({
          id: String(log._id),
          action: log.action,
          subject: log.subject,
          time: log.createdAt,
          createdAt: log.createdAt,
        })),
      }
    }
  )

  route(
    'post',
    '/api/admin/audit-logs',
    ['admin'],
    async ({ body, user }) => {
      const log = await AuditLog.create({
        actorId: user._id,
        action: text(body.action, 'Audit action', 160),
        subject: text(body.subject, 'Audit subject', 200),
      })
      return { status: 201, data: { log: { id: String(log._id), action: log.action, subject: log.subject, time: log.createdAt } } }
    }
  )


  // Supabase is the identity provider. Only a verified Supabase bearer token
  // may link or create a MongoDB profile and receive a Queueless session.
  route(
    'post',
    '/api/auth/supabase-session',
    null,
    async ({ token }) => {
      if (!token) fail('Missing Supabase access token.', 401)
      if (!supabase) fail('Supabase backend configuration is missing.', 503)

      const { data, error } = await supabase.auth.getUser(token)
      if (error || !data?.user) fail('Invalid Supabase access token.', 401)
      const identity = data.user
      if (!identity.email_confirmed_at) fail('Verify your email before signing in.', 403)
      const email = emailValue(identity.email)
      const uid = identity.id
      let user = await User.findOne({ supabaseUserId: uid })
      if (!user) {
        user = await User.findOne({ email })
        if (user?.supabaseUserId && user.supabaseUserId !== uid) {
          fail('This email is already linked to another identity.', 409)
        }
        if (user) {
          // Link existing local users without modifying their admin/staff role.
          user.supabaseUserId = uid
          user.emailVerified = true
          await user.save()
        } else {
          const profile = identity.user_metadata || {}
          const accountId = String(profile.account_id || '').trim()
          if (!accountId || !/^03-\d{4}-\d{5,6}$/.test(accountId)) {
            fail('Your Supabase account has no valid student ID. Contact an administrator.', 422)
          }
          if (await User.exists({ accountId })) {
            fail('Student ID is linked to another account. Contact an administrator.', 409)
          }
          try {
            user = await User.create({
              supabaseUserId: uid,
              email,
              name: nameValue(profile.full_name || ''),
              accountId,
              department: String(profile.department || '').slice(0, 100),
              yearLevel: String(profile.year_level || '').slice(0, 50),
              semester: String(profile.semester || '').slice(0, 30),
              role: 'student',
              status: 'Active',
              emailVerified: true,
              privacyConsentAt: new Date(),
              // Legacy required field only; NEVER used to authenticate Supabase users.
              passwordHash: hash(crypto.randomBytes(32).toString('hex')),
            })
          } catch (err) {
            if (err?.code === 11000) fail('Account already exists. Retry sign in or contact support.', 409)
            throw err
          }
        }
      }
      if (user.status !== 'Active') fail('Account is not active. Contact an administrator.', 403)
      return createSession(user)
    }
  )

  route(
    'post',
    '/api/auth/register',
    null,

    async ({
      body,
    }) => {
      const role =
        body.role ??
        'student'


      if (
        ![
          'student',
          'staff',
        ].includes(role)
      ) {
        fail(
          'Only student and staff accounts can self-register.',
          403
        )
      }


      const email =
  emailValue(
    body.email
  )

if (role === 'student') {
  const expectedEmail =
    expectedPhinmaEmail(
      body.name
    )

  if (email !== expectedEmail) {
    fail(
      `The name and PHINMA email do not match. Based on the name entered, the expected email is ${expectedEmail}`
    )
  }
}

if (body.privacyConsent !== true) {
  fail(
    'You must accept the Privacy Notice to create an account.'
  )
}

      if (body.privacyConsent !== true) {
        fail('You must accept the Privacy Notice to create an account.')
      }


      if (
        await User.exists({
          email,
        })
      ) {
        fail(
          'An account with that email already exists.',
          409
        )
      }


      const userData = {
        name:
          nameValue(
            body.name
          ),

        email,

        passwordHash:
          hash(
            passwordValue(
              body.password
            )
          ),

        emailVerified: false,

        privacyConsentAt: new Date(),

        role,

        status:
          role ===
          'staff'
            ? 'Pending'
            : 'Active',

        department:
          typeof body.department ===
          'string'
            ? body.department
                .trim()
                .slice(
                  0,
                  100
                )
            : '',

        yearLevel:
          typeof body.yearLevel ===
          'string'
            ? body.yearLevel
                .trim()
                .slice(
                  0,
                  50
                )
            : '',

        semester:
          typeof body.semester ===
          'string'
            ? body.semester
                .trim()
                .slice(
                  0,
                  30
                )
            : '',
      }


      if (
        role ===
        'student'
      ) {
        const accountId =
          typeof body.accountId ===
          'string'
            ? body.accountId.trim()
            : ''


        if (
          !/^03-\d{4}-\d{5,6}$/.test(
            accountId
          )
        ) {
          fail(
            'Student ID must use the format 03-1234-12345 or 03-1234-123456.'
          )
        }


        if (
          await User.exists({
            accountId,
          })
        ) {
          fail(
            'School ID is already registered.',
            409
          )
        }


        userData.accountId =
          accountId
      } else {
        const office =
          await findOffice(
            body.office
          )

        userData.office =
          office.name
      }


      let user


      try {
        user =
          await User.create(
            userData
          )
      } catch (error) {
        if (
          error?.code ===
          11000
        ) {
          fail(
            'That email or school ID is already registered.',
            409
          )
        }

        throw error
      }

      const code = newOtp()
      user.emailVerificationCodeHash = digest(code)
      user.emailVerificationExpiresAt = new Date(Date.now() + emailVerificationLifetimeMs)
      user.emailVerificationAttempts = 0
      await user.save()
      const delivery = await sendEmailCode(email, code, 'verify')

      return {
        status: 201,
        data:
          {
            verificationRequired: true,
            email,
            message: delivery?.transport === 'console'
              ? 'Local email mode is enabled. Copy the verification code from the API server terminal.'
              : 'We sent a verification code to your email. Enter it to activate your account.',
          },
      }
    }
  )


  route(
    'post',
    '/api/auth/login',
    null,

    async ({
      body,
    }) => {
      const email =
        emailValue(
          body.email
        )


      const user =
        await User.findOne({
          email,
        })


      if (
        !user ||
        !verify(
          body.password,
          user.passwordHash
        )
      ) {
        fail(
          'Account not found or password is incorrect.',
          401
        )
      }

      if (user.supabaseUserId) {
        fail('Use Supabase sign-in for this account.', 403)
      }

      if (!user.emailVerified) {
        fail('Verify your email address before signing in.', 403)
      }


      if (
        user.status ===
        'Pending'
      ) {
        fail(
          'Your staff account is awaiting admin approval.',
          403
        )
      }


      if (
        user.status !==
        'Active'
      ) {
        fail(
          'Your account is inactive. Contact an administrator for help.',
          403
        )
      }


      return createSession(
        user
      )
    }
  )


  route(
    'post',
    '/api/auth/forgot-password',
    null,

    async ({ body }) => {
      const email = emailValue(body.email)
      const user = await User.findOne({ email }).select('+resetPasswordTokenHash +resetPasswordExpiresAt +resetPasswordAttempts')
      const response = {
        message: 'If an account exists for that email, a password reset code has been sent.',
      }

      // The response is intentionally identical for unknown accounts.
      if (!user) return response

      const code = newOtp()
      user.resetPasswordTokenHash = digest(code)
      user.resetPasswordExpiresAt = new Date(Date.now() + passwordResetLifetimeMs)
      user.resetPasswordAttempts = 0
      await user.save()

      await sendEmailCode(email, code, 'reset')

      return response
    }
  )


  route(
    'post',
    '/api/auth/reset-password',
    null,

    async ({ body }) => {
      const email = emailValue(body.email)
      const code = text(body.code, 'Reset code', 6)
      if (!/^\d{6}$/.test(code)) fail('Enter the six-digit reset code.')
      const user = await User.findOne({ email }).select('+resetPasswordTokenHash +resetPasswordExpiresAt +resetPasswordAttempts')

      if (!user || !user.resetPasswordExpiresAt || user.resetPasswordExpiresAt <= new Date()) {
        fail('This password reset code is invalid or has expired.', 400)
      }
      if ((user.resetPasswordAttempts || 0) >= 5) fail('Too many incorrect codes. Request a new code.', 429)
      if (!user.resetPasswordTokenHash || !crypto.timingSafeEqual(Buffer.from(user.resetPasswordTokenHash), Buffer.from(digest(code)))) {
        user.resetPasswordAttempts = (user.resetPasswordAttempts || 0) + 1
        await user.save()
        fail('This password reset code is invalid or has expired.', 400)
      }

      user.passwordHash = hash(passwordValue(body.password))
      user.resetPasswordTokenHash = null
      user.resetPasswordExpiresAt = null
      user.resetPasswordAttempts = 0
      await user.save()
      await Session.deleteMany({ userId: user._id })

      return { message: 'Your password has been reset. You can now sign in.' }
    }
  )


  route(
    'post',
    '/api/auth/verify-email',
    null,

    async ({ body }) => {
      const email = emailValue(body.email)
      const code = text(body.code, 'Verification code', 6)
      if (!/^\d{6}$/.test(code)) fail('Enter the six-digit verification code.')
      const user = await User.findOne({ email }).select('+emailVerificationCodeHash +emailVerificationExpiresAt +emailVerificationAttempts')

      if (!user || !user.emailVerificationExpiresAt || user.emailVerificationExpiresAt <= new Date()) {
        fail('This verification code is invalid or has expired.', 400)
      }
      if ((user.emailVerificationAttempts || 0) >= 5) fail('Too many incorrect codes. Request a new code.', 429)
      if (!user.emailVerificationCodeHash || !crypto.timingSafeEqual(Buffer.from(user.emailVerificationCodeHash), Buffer.from(digest(code)))) {
        user.emailVerificationAttempts = (user.emailVerificationAttempts || 0) + 1
        await user.save()
        fail('This verification code is invalid or has expired.', 400)
      }

      user.emailVerified = true
      user.emailVerificationCodeHash = null
      user.emailVerificationExpiresAt = null
      user.emailVerificationAttempts = 0
      await user.save()

      return { message: user.status === 'Pending' ? 'Email verified. Your account is awaiting administrator approval.' : 'Email verified. You can now sign in.' }
    }
  )


  route(
    'post',
    '/api/auth/resend-verification',
    null,

    async ({ body }) => {
      const email = emailValue(body.email)
      const user = await User.findOne({ email }).select('+emailVerificationCodeHash +emailVerificationExpiresAt +emailVerificationAttempts')
      const response = { message: 'If an unverified account exists for that email, a new code has been sent.' }
      if (!user || user.emailVerified) return response

      const code = newOtp()
      user.emailVerificationCodeHash = digest(code)
      user.emailVerificationExpiresAt = new Date(Date.now() + emailVerificationLifetimeMs)
      user.emailVerificationAttempts = 0
      await user.save()
      const delivery = await sendEmailCode(email, code, 'verify')
      return delivery?.transport === 'console'
        ? { message: 'A new verification code was written to the API server terminal.' }
        : response
    }
  )


  route(
    'get',
    '/api/auth/me',
    [],

    async ({
      user,
    }) => ({
      user:
        publicUser(user),
    })
  )

  route(
    'post',
    '/api/auth/switch-role',
    [],
    async ({ body, user, session }) => {
      const role = text(body.role, 'Role', 20)
      if (!grantedRoles(user).includes(role)) {
        fail('You do not have access to that dashboard.', 403)
      }
      user.role = role
      session.activeRole = role
      await Promise.all([user.save(), session.save()])
      return { user: publicUser(user) }
    }
  )

  route(
    'get',
    '/api/notifications/promotion',
    ['student'],
    async ({ user }) => {
      const invitation = await PromotionInvitation.findOne({
        studentId: user._id,
        status: 'pending',
      }).sort({ createdAt: -1 })
      if (!invitation) return { notification: null }
      return {
        notification: {
          id: String(invitation._id),
          title: 'Staff promotion invitation',
          message: `You have been invited to join the ${invitation.office} office as ${invitation.staffRole}.`,
          office: invitation.office,
          staffRole: invitation.staffRole,
          schedule: invitation.schedule,
          createdAt: invitation.createdAt,
        },
      }
    }
  )

  route(
    'post',
    '/api/notifications/promotion/:id/respond',
    ['student'],
    async ({ req, body, user }) => {
      if (!mongoose.isValidObjectId(req.params.id)) fail('Promotion invitation not found.', 404)
      const action = text(body.action, 'Promotion response', 10)
      if (!['accept', 'decline'].includes(action)) fail('Choose accept or decline.')
      const invitation = await PromotionInvitation.findOne({
        _id: req.params.id,
        studentId: user._id,
        status: 'pending',
      })
      if (!invitation) fail('Promotion invitation not found or already answered.', 404)

      invitation.status = action === 'accept' ? 'accepted' : 'declined'
      invitation.respondedAt = new Date()
      if (action === 'accept') {
        user.roles = Array.from(new Set([...grantedRoles(user), 'student', 'staff']))
        user.office = invitation.office
        user.staffRole = invitation.staffRole
        user.schedule = invitation.schedule
        await user.save()
      }
      await invitation.save()
      return { invitation: { id: String(invitation._id), status: invitation.status }, user: publicUser(user) }
    }
  )


  route(
    'post',
    '/api/auth/logout',
    [],

    async ({
      session,
    }) => {
      await Session.deleteOne({
        _id:
          session._id,
      })


      return {
        success: true,
      }
    }
  )


  route(
    'post',
    '/api/offices',
    [
      'admin',
    ],

    async ({
      body,
    }) => {
      const name = text(body.name, 'Office name', 80)
      const code = text(body.code, 'Ticket code', 4).toUpperCase()
      const service = text(body.service, 'First service', 100)
      const wait = Number(body.wait)

      if (!/^[A-Z0-9]{1,4}$/.test(code)) {
        fail('Ticket code must contain one to four letters or numbers.')
      }

      if (!Number.isInteger(wait) || wait < 1 || wait > 120) {
        fail('Typical service time must be between 1 and 120 minutes.')
      }

      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      if (!slug) fail('Office name must include letters or numbers.')

      if (await Office.exists({ $or: [{ name }, { code }, { slug }] })) {
        fail('An office with that name or ticket code already exists.', 409)
      }

      const office = await Office.create({
        slug,
        name,
        code,
        wait,
        open: true,
        sequence: 0,
        hours: '8:00 AM - 5:00 PM',
      description: typeof body.description === 'string' ? body.description.trim().slice(0, 240) : '',
      icon: typeof body.icon === 'string' ? body.icon.trim().slice(0, 40) : '',
      color: typeof body.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(body.color) ? body.color : '',
        services: [{ name: service, requirements: ['Valid school ID'] }],
      })

      return {
        status: 201,
        data: { office: apiOffice(office) },
      }
    }
  )


  route(
    'patch',
    '/api/auth/profile',
    [],

    async ({
      user,
      body,
      session,
    }) => {
      if (
        body.name !==
        undefined
      ) {
        user.name =
          nameValue(
            body.name
          )
      }


      if (
        body.email !==
        undefined
      ) {
        const email =
          emailValue(
            body.email
          )


        if (
          await User.exists({
            _id: {
              $ne:
                user._id,
            },

            email,
          })
        ) {
          fail(
            'Email is already registered.',
            409
          )
        }


        user.email =
          email
      }


      for (
        const [
          field,
          max,
        ]
        of [
          [
            'department',
            100,
          ],

          [
            'yearLevel',
            50,
          ],

          [
            'semester',
            30,
          ],
        ]
      ) {
        if (
          body[field] !==
          undefined
        ) {
          user[field] =
            text(
              body[field],
              field,
              max
            )
        }
      }

      if (
        body.avatar !==
        undefined
      ) {
        if (
          body.avatar ===
          ''
        ) {
          user.avatar =
            ''
        } else if (
          typeof body.avatar !==
          'string' ||
          body.avatar.length >
          700000 ||
          !/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(
            body.avatar
          )
        ) {
          fail(
            'Use a PNG, JPEG, or WebP profile photo smaller than 500 KB.'
          )
        } else {
          user.avatar =
            body.avatar
        }
      }


      if (
        body.password
      ) {
        user.passwordHash =
          hash(
            passwordValue(
              body.password
            )
          )


        await Session.deleteMany(
          {
            userId:
              user._id,

            _id: {
              $ne:
                session._id,
            },
          }
        )
      }


      await user.save()


      return {
        user:
          publicUser(user),
      }
    }
  )


  route(
    'patch',
    '/api/staff/schedule',
    [
      'staff',
    ],

    async ({
      user,
      body,
    }) => {
      user.schedule =
        scheduleValue(
          body.schedule
        )


      await user.save()


      return {
        user:
          publicUser(user),
      }
    }
  )


  route(
    'get',
    '/api/portal/state',
    [],

    async ({
      user,
    }) => {
      const offices =
        await Office
          .find()
          .sort({
            name: 1,
          })


      let ticketQuery =
        {}


      if (
        user.role ===
        'student'
      ) {
        ticketQuery = {
          studentId:
            user._id,
        }
      }


      if (
        user.role ===
        'staff'
      ) {
        const assignedOffice =
          await findOffice(
            user.office
          )


        ticketQuery = {
          officeId:
            assignedOffice._id,
        }
      }


      const tickets =
        await Ticket
          .find(
            ticketQuery
          )
          .sort({
            createdAt: 1,
          })


      const ticketIds =
        tickets.map(
          ticket =>
            ticket._id
        )


      const studentIds =
        [
          ...new Set(
            tickets.map(
              ticket =>
                String(
                  ticket.studentId
                )
            )
          ),
        ]


      const officeIds =
        [
          ...new Set(
            tickets.map(
              ticket =>
                String(
                  ticket.officeId
                )
            )
          ),
        ]


      const students =
        await User.find({
          _id: {
            $in:
              studentIds,
          },
        })


      const ticketOffices =
        await Office.find({
          _id: {
            $in:
              officeIds,
          },
        })


      const feedbackDocs =
        ticketIds.length
          ? await Feedback.find(
              {
                ticketId: {
                  $in:
                    ticketIds,
                },
              }
            )
          : []


      const studentMap =
        new Map(
          students.map(
            student => [
              String(
                student._id
              ),

              student,
            ]
          )
        )


      const officeMap =
        new Map(
          ticketOffices.map(
            office => [
              String(
                office._id
              ),

              office,
            ]
          )
        )


      const feedbackMap =
        new Map(
          feedbackDocs.map(
            feedback => [
              String(
                feedback.ticketId
              ),

              feedback,
            ]
          )
        )


      const activeAllToday =
        await Ticket.find({
          visitDate:
            today(),

          status: {
            $in: [
              'waiting',
              'serving',
              'served',
            ],
          },
        })


      const allFeedback =
        await Feedback
          .find()
          .populate(
            'ticketId'
          )
          .populate(
            'studentId'
          )
          .populate(
            'officeId'
          )


      const officeApi =
        offices.map(
          office => {
            const relevant =
              activeAllToday.filter(
                ticket =>
                  String(
                    ticket.officeId
                  ) ===
                  String(
                    office._id
                  )
              )


            const waiting =
              relevant.filter(
                ticket =>
                  ticket.status ===
                  'waiting'
              ).length


            const serving =
              relevant.find(
                ticket =>
                  ticket.status ===
                  'serving'
              )
                ?.ticketNumber ||
              ''


            const servedTickets =
              relevant.filter(
                ticket =>
                  ticket.status ===
                  'served'
              )


            const officeFeedback =
              allFeedback.filter(
                feedback =>
                  String(
                    feedback
                      .officeId
                      ?._id ||
                    feedback
                      .officeId
                  ) ===
                  String(
                    office._id
                  )
              )


            const avgWait =
              servedTickets.length
                ? Math.round(
                    servedTickets.reduce(
                      (
                        sum,
                        ticket
                      ) =>
                        sum +
                        (
                          ticket.calledAt
                            ? (
                                new Date(
                                  ticket.calledAt
                                ) -
                                new Date(
                                  ticket.createdAt
                                )
                              ) /
                              60000
                            : 0
                        ),

                      0
                    ) /
                    servedTickets.length
                  )
                : 0


            // A queue estimate should follow how quickly this office is
            // actually completing visits today, not only its default setting.
            const serviceMinutes =
              servedTickets.length
                ? Math.max(
                    1,
                    Math.round(
                      servedTickets.reduce(
                        (sum, ticket) =>
                          sum +
                          (
                            ticket.calledAt &&
                            ticket.servedAt
                              ? (
                                  new Date(ticket.servedAt) -
                                  new Date(ticket.calledAt)
                                ) / 60000
                              : 0
                          ),
                        0
                      ) / servedTickets.length
                    )
                  )
                : office.wait


            const rating =
              officeFeedback.length
                ? Number(
                    (
                      officeFeedback.reduce(
                        (
                          sum,
                          feedback
                        ) =>
                          sum +
                          feedback.rating,

                        0
                      ) /
                      officeFeedback.length
                    ).toFixed(
                      1
                    )
                  )
                : 0


            const completion =
              relevant.length
                ? Math.round(
                    (
                      servedTickets.length /
                      relevant.length
                    ) *
                    100
                  )
                : 0


            return apiOffice(
              office,
              {
                waiting,
                serving,

                served:
                  servedTickets.length,

                avgWait,
                serviceMinutes,
                rating,
                completion,
              }
            )
          }
        )


      const ticketApi =
        []


      for (
        const ticket
        of tickets
      ) {
        const office =
          officeMap.get(
            String(
              ticket.officeId
            )
          )


        const student =
          studentMap.get(
            String(
              ticket.studentId
            )
          )


        const line =
          await Ticket
            .find({
              officeId:
                ticket.officeId,

              visitDate:
                ticket.visitDate,

              status: {
                $in: [
                  'waiting',
                  'serving',
                ],
              },
            })
            .sort({
              status: 1,
              order: 1,
            })


        const queuePosition =
          Math.max(
            0,

            line.findIndex(
              item =>
                String(
                  item._id
                ) ===
                String(
                  ticket._id
                )
            )
          )


        ticketApi.push(
          apiTicket(
            ticket,
            {
              student,
              office,
              queuePosition,

              feedback:
                feedbackMap.get(
                  String(
                    ticket._id
                  )
                ),
            }
          )
        )
      }


      let feedback =
        []


      if (
        user.role ===
        'admin'
      ) {
        feedback =
          allFeedback.map(
            item => ({
              rating:
                item.rating,

              comment:
                item.comment,

              ticket:
                item.ticketId
                  ?.ticketNumber ||
                '',

              student:
                item.studentId
                  ?.name ||
                '',

              office:
                item.officeId
                  ?.name ||
                '',

              time:
                item.createdAt,
            })
          )
      } else if (
        user.role ===
        'staff'
      ) {
        feedback =
          allFeedback
            .filter(
              item =>
                item.officeId
                  ?.name ===
                user.office
            )
            .map(
              item => ({
                rating:
                  item.rating,

                comment:
                  item.comment,

                ticket:
                  item.ticketId
                    ?.ticketNumber ||
                  '',

                student:
                  item.studentId
                    ?.name ||
                  '',

                office:
                  item.officeId
                    ?.name ||
                  '',

                time:
                  item.createdAt,
              })
            )
      }


      const data = {
        offices:
          officeApi,

        tickets:
          ticketApi,

        feedback,
      }


      if (
        user.role ===
        'admin'
      ) {
        const users = await User.find({
  deletedAt: null
}).sort({
  createdAt: -1
});


        const ticketCounts =
          await Ticket.aggregate(
            [
              {
                $group: {
                  _id:
                    '$studentId',

                  count: {
                    $sum: 1,
                  },

                  last: {
                    $max:
                      '$createdAt',
                  },
                },
              },
            ]
          )


        const counts =
          new Map(
            ticketCounts.map(
              item => [
                String(
                  item._id
                ),

                item,
              ]
            )
          )


        data.users =
          users.map(
            currentUser => ({
              ...publicUser(
                currentUser
              ),

              department:
                currentUser.department ||
                '',

              queues:
                counts.get(
                  String(
                    currentUser._id
                  )
                )
                  ?.count ||
                0,

              last:
                counts.get(
                  String(
                    currentUser._id
                  )
                )
                  ?.last ||
                'Never',
            })
          )

        const trendDates = Array.from({ length: 7 }, (_, index) => {
          const date = new Date()
          date.setDate(date.getDate() - (6 - index))
          return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(date)
        })
        const trendCounts = await Ticket.aggregate([
          { $match: { visitDate: { $in: trendDates } } },
          { $group: { _id: '$visitDate', count: { $sum: 1 } } },
        ])
        const trendMap = new Map(trendCounts.map((item) => [item._id, item.count]))
        data.queueTrends = trendDates.map((date) => ({ date, count: trendMap.get(date) || 0 }))
      }


      return data
    }
  )


  route(
    'post',
    '/api/tickets',
    [
      'student',
    ],

    async ({
      user,
      body,
    }) => {
      const office =
        await findOffice(
          body.officeId
        )


      if (
        !office.open
      ) {
        fail(
          'This office is not accepting tickets.'
        )
      }


      if (
        !office.services.some(
          service =>
            service.name ===
            body.service
        )
      ) {
        fail(
          'Select a valid service for this office.'
        )
      }


      if (
        await Ticket.exists({
          studentId:
            user._id,

          status: {
            $in:
              activeStatuses,
          },
        })
      ) {
        fail(
          'You already have an active ticket.',
          409
        )
      }


      const visitDate =
        body.visitDate ||
        today()


      if (
        typeof visitDate !==
          'string' ||

        !/^\d{4}-\d{2}-\d{2}$/.test(
          visitDate
        ) ||

        !Number.isFinite(
          Date.parse(
            visitDate
          )
        ) ||

        new Date(
          `${visitDate}T00:00:00Z`
        )
          .toISOString()
          .slice(
            0,
            10
          ) !==
          visitDate ||

        visitDate <
          today()
      ) {
        fail(
          'Choose today or a future queue date.'
        )
      }


      const updatedOffice =
        await Office.findOneAndUpdate(
          {
            _id:
              office._id,
          },
          {
            $inc: {
              sequence: 1,
            },
          },
          {
            new: true,
          }
        )


      let ticket
      try {
        ticket = await Ticket.create({
          ticketNumber:
            `${office.code}-${String(
              updatedOffice.sequence
            ).padStart(
              3,
              '0'
            )}`,

          studentId:
            user._id,

          officeId:
            office._id,

          service:
            body.service,

          status:
            'waiting',

          visitDate,

          order:
            Date.now(),
        })
      } catch (error) {
        // The partial unique index on studentId makes the active-ticket rule
        // safe under concurrent requests. Translate its driver error to the
        // same stable API response used by the earlier pre-flight check.
        if (error?.code === 11000 && error?.keyPattern?.studentId) {
          fail('You already have an active ticket.', 409)
        }
        throw error
      }


      const line =
        await Ticket.countDocuments(
          {
            officeId:
              office._id,

            visitDate,

            status: {
              $in: [
                'waiting',
                'serving',
              ],
            },

            order: {
              $lt:
                ticket.order,
            },
          }
        )


      return {
        status: 201,

        data: {
          ticket:
            apiTicket(
              ticket,
              {
                student:
                  user,

                office,

                queuePosition:
                  line,
              }
            ),
        },
      }
    }
  )


  route(
    'patch',
    '/api/tickets/:ticketId/cancel',
    [
      'student',
    ],

    async ({
      user,
      req,
    }) => {
      if (
        !mongoose.isValidObjectId(
          req.params.ticketId
        )
      ) {
        fail(
          'Ticket not found.',
          404
        )
      }


      const ticket =
        await Ticket.findOne(
          {
            _id:
              req.params.ticketId,

            studentId:
              user._id,
          }
        )


      if (!ticket) {
        fail(
          'Ticket not found.',
          404
        )
      }


      if (
        !activeStatuses.includes(
          ticket.status
        )
      ) {
        fail(
          'This ticket is already closed.',
          409
        )
      }


      ticket.status =
        'cancelled'

      ticket.completedAt =
        new Date()


      await ticket.save()


      const office =
        await Office.findById(
          ticket.officeId
        )


      return {
        ticket:
          apiTicket(
            ticket,
            {
              student:
                user,

              office,
            }
          ),
      }
    }
  )


  route(
    'post',
    '/api/tickets/:ticketId/action',
    [
      'staff',
      'admin',
    ],

    async ({
      user,
      req,
      body,
    }) => {
      if (
        !mongoose.isValidObjectId(
          req.params.ticketId
        )
      ) {
        fail(
          'Ticket not found.',
          404
        )
      }


      const ticket =
        await Ticket.findById(
          req.params.ticketId
        )


      if (!ticket) {
        fail(
          'Ticket not found.',
          404
        )
      }


      const office =
        await Office.findById(
          ticket.officeId
        )


      if (
        user.role ===
          'staff' &&
        user.office !==
          office.name
      ) {
        fail(
          'This office is not assigned to you.',
          403
        )
      }


      const transitions = {
        call: [
          'waiting',
          'serving',
        ],

        skip: [
          'serving',
          'skipped',
        ],

        recall: [
          'skipped',
          'waiting',
        ],

        serve: [
          'serving',
          'served',
        ],
      }


      const transition =
        transitions[
          body.action
        ]


      if (
        !transition ||
        ticket.status !==
          transition[0]
      ) {
        fail(
          'That action is not valid for the current ticket status.',
          409
        )
      }


      if (
        ticket.visitDate !==
        today()
      ) {
        fail(
          'Only tickets scheduled for today can be served.',
          409
        )
      }


      if (
        body.action ===
        'call'
      ) {
        if (
          await Ticket.exists(
            {
              officeId:
                ticket.officeId,

              visitDate:
                today(),

              status:
                'serving',

              _id: {
                $ne:
                  ticket._id,
              },
            }
          )
        ) {
          fail(
            'Finish or skip the current ticket first.',
            409
          )
        }


        const first =
          await Ticket
            .findOne({
              officeId:
                ticket.officeId,

              visitDate:
                today(),

              status:
                'waiting',
            })
            .sort({
              order: 1,
            })


        if (
          !first ||
          String(
            first._id
          ) !==
            String(
              ticket._id
            )
        ) {
          fail(
            'Call the first waiting ticket.',
            409
          )
        }


        ticket.calledAt =
          new Date()
      }


      if (
        body.action ===
        'recall'
      ) {
        const firstWaiting =
          await Ticket
            .findOne({
              officeId:
                ticket.officeId,

              visitDate:
                today(),

              status:
                'waiting',
            })
            .sort({
              order: 1,
            })


        ticket.order =
          firstWaiting
            ? firstWaiting.order -
              1
            : Date.now()
      }


      ticket.status =
        transition[1]


      if (
        ticket.status ===
        'served'
      ) {
        ticket.servedAt =
          new Date()

        ticket.completedAt =
          ticket.servedAt
      }


      await ticket.save()


      const student =
        await User.findById(
          ticket.studentId
        )


      return {
        ticket:
          apiTicket(
            ticket,
            {
              student,
              office,
            }
          ),
      }
    }
  )


  route(
    'post',
    '/api/tickets/:ticketId/feedback',
    [
      'student',
    ],

    async ({
      user,
      req,
      body,
    }) => {
      if (
        !mongoose.isValidObjectId(
          req.params.ticketId
        )
      ) {
        fail(
          'Ticket not found.',
          404
        )
      }


      const ticket =
        await Ticket.findOne(
          {
            _id:
              req.params.ticketId,

            studentId:
              user._id,
          }
        )


      if (!ticket) {
        fail(
          'Ticket not found.',
          404
        )
      }


      if (
        ticket.status !==
        'served'
      ) {
        fail(
          'Feedback is allowed once per completed visit.',
          409
        )
      }


      if (
        await Feedback.exists(
          {
            ticketId:
              ticket._id,
          }
        )
      ) {
        fail(
          'Feedback is allowed once per completed visit.',
          409
        )
      }


      if (
        !Number.isInteger(
          body.rating
        ) ||
        body.rating <
          1 ||
        body.rating >
          5
      ) {
        fail(
          'Rating must be an integer from 1 to 5.'
        )
      }


      if (
        body.comment !==
          undefined &&
        (
          typeof body.comment !==
            'string' ||
          body.comment.length >
            2000
        )
      ) {
        fail(
          'Comment must be at most 2000 characters.'
        )
      }


      const feedback =
        await Feedback.create({
          ticketId:
            ticket._id,

          studentId:
            user._id,

          officeId:
            ticket.officeId,

          rating:
            body.rating,

          comment:
            body.comment
              ?.trim() ||
            '',
        })


      return {
        feedback: {
          rating:
            feedback.rating,

          comment:
            feedback.comment,

          createdAt:
            feedback.createdAt,
        },
      }
    }
  )


  route(
    'patch',
    '/api/offices/:officeId',
    [
      'admin',
    ],

    async ({
      req,
      body,
    }) => {
      const office =
        await findOffice(
          req.params.officeId
        )


      if (
        typeof body.open !==
        'boolean'
      ) {
        fail(
          'Open must be true or false.'
        )
      }


      office.open =
        body.open


      await office.save()


      return {
        office:
          apiOffice(
            office
          ),
      }
    }
  )


  route(
    'delete',
    '/api/offices/:officeId',
    [
      'admin',
    ],

    async ({ req }) => {
      const office = await findOffice(req.params.officeId)
      const hasActiveTickets = await Ticket.exists({
        officeId: office._id,
        status: { $in: activeStatuses },
      })
      const hasAssignedStaff = await User.exists({
        role: 'staff',
        office: office.name,
      })

      if (hasActiveTickets) {
        fail('This office has active queue tickets. Close or cancel them before deleting the office.', 409)
      }
      if (hasAssignedStaff) {
        fail('Reassign or remove staff assigned to this office before deleting it.', 409)
      }

      await office.deleteOne()
      return { deleted: true }
    }
  )


  route(
    'post',
    '/api/offices/:officeId/requirements',
    [
      'admin',
      'staff',
    ],

    async ({
      user,
      req,
      body,
    }) => {
      const office =
        await findOffice(
          req.params.officeId
        )


      if (
        user.role ===
          'staff' &&
        user.office !==
          office.name
      ) {
        fail(
          'This office is not assigned to you.',
          403
        )
      }


      const requirement =
        text(
          body.requirement,
          'Requirement',
          500
        )


      const indexes =
        body.serviceIndex ===
        undefined
          ? office.services.map(
              (
                _,
                index
              ) =>
                index
            )
          : [
              Number(
                body.serviceIndex
              ),
            ]


      for (
        const index
        of indexes
      ) {
        if (
          !office.services[
            index
          ]
        ) {
          fail(
            'Service not found.',
            404
          )
        }


        if (
          !office.services[
            index
          ].requirements.includes(
            requirement
          )
        ) {
          office.services[
            index
          ].requirements.push(
            requirement
          )
        }
      }


      await office.save()


      return {
        office:
          apiOffice(
            office
          ),
      }
    }
  )

  route(
    'patch',
    '/api/offices/:officeId/services/:serviceIndex',
    ['admin'],
    async ({ req, body }) => {
      const office = await findOffice(req.params.officeId)
      const index = Number(req.params.serviceIndex)
      if (!Number.isInteger(index) || !office.services[index]) fail('Service not found.', 404)
      const name = text(body.name, 'Service name', 100)
      if (office.services.some((service, serviceIndex) => serviceIndex !== index && service.name.toLowerCase() === name.toLowerCase())) {
        fail('A service with that name already exists for this office.', 409)
      }
      office.services[index].name = name
      await office.save()
      return { office: apiOffice(office) }
    }
  )


  route(
    'post',
    '/api/admin/staff/invitations',
    ['admin'],
    async ({ body, user: admin }) => {
      const email = emailValue(body.email)
      const student = await User.findOne({ email, status: 'Active' })
      if (!student || !grantedRoles(student).includes('student')) {
        fail('A registered active student with this email was not found.', 404)
      }
      if (grantedRoles(student).includes('staff')) {
        fail('This student already has staff access.', 409)
      }
      if (await PromotionInvitation.exists({ studentId: student._id, status: 'pending' })) {
        fail('This student already has a pending promotion invitation.', 409)
      }
      const office = await findOffice(body.office)
      const invitation = await PromotionInvitation.create({
        studentId: student._id,
        invitedBy: admin._id,
        office: office.name,
        staffRole: text(body.staffRole || 'Service staff', 'Staff role', 80),
        schedule: scheduleValue(body.schedule ?? []),
      })
      return {
        status: 201,
        data: {
          invitation: {
            id: String(invitation._id),
            status: invitation.status,
            studentEmail: student.email,
            office: invitation.office,
            staffRole: invitation.staffRole,
          },
          message: 'Promotion invitation sent to the student.',
        },
      }
    }
  )

  route(
    'get',
    '/api/admin/staff/invitations',
    ['admin'],
    async () => {
      const invitations = await PromotionInvitation.find().sort({ createdAt: -1 }).populate('studentId', 'name email')
      return {
        invitations: invitations.map((item) => ({
          id: String(item._id), status: item.status, office: item.office, staffRole: item.staffRole,
          student: item.studentId ? { name: item.studentId.name, email: item.studentId.email } : null,
          createdAt: item.createdAt, respondedAt: item.respondedAt,
        })),
      }
    }
  )

  route(
    'post',
    '/api/admin/staff',
    [
      'admin',
    ],

    async ({
      body,
    }) => {
      const email =
        emailValue(
          body.email
        )


      if (
        await User.exists({
          email,
        })
      ) {
        fail(
          'An account with that email already exists.',
          409
        )
      }


      const office =
        await findOffice(
          body.office
        )

      const schedule =
        scheduleValue(
          body.schedule ?? []
        )


      const user =
        await User.create({
          name:
            email.split('@')[0],

          email,

          passwordHash:
            hash(
              crypto.randomBytes(32).toString('base64url')
            ),

          role:
            'staff',

          status:
            'Active',

          office:
            office.name,

          schedule,
        })


      return {
        status: 201,

        data: {
          user:
            publicUser(
              user
            ),
        },
      }
    }
  )


  route(
    'patch',
    '/api/admin/staff/:id/approval',
    [
      'admin',
    ],

    async ({
      req,
      body,
    }) => {
      if (
        ![
          'approve',
          'reject',
        ].includes(
          body.action
        )
      ) {
        fail(
          'Invalid approval action.'
        )
      }


      const user =
        await User.findOne(
          {
            _id:
              req.params.id,

            role:
              'staff',
          }
        )


      if (!user) {
        fail(
          'Staff account not found.',
          404
        )
      }


      if (
        user.status !==
        'Pending'
      ) {
        fail(
          'Only pending staff accounts can be reviewed.',
          409
        )
      }


      user.status =
        body.action ===
        'approve'
          ? 'Active'
          : 'Inactive'


      await user.save()


      return {
        user:
          publicUser(user),
      }
    }
  )


  route(
    'patch',
    '/api/admin/staff/:id/schedule',
    [
      'admin',
    ],

    async ({
      req,
      body,
    }) => {
      const user =
        await User.findOne(
          {
            _id:
              req.params.id,

            role:
              'staff',
          }
        )


      if (!user) {
        fail(
          'Staff account not found.',
          404
        )
      }


      user.schedule =
        scheduleValue(
          body.schedule
        )


      await user.save()


      return {
        user:
          publicUser(user),
      }
    }
  )

  route(
    'patch',
    '/api/admin/staff/:id',
    ['admin'],
    async ({ req, body }) => {
      const staffMember = await User.findOne({ _id: req.params.id, role: 'staff', deletedAt: null })
      if (!staffMember) fail('Staff account not found.', 404)
      const office = text(body.office, 'Office', 80)
      const staffRole = text(body.staffRole, 'Staff position', 80)
      const officeRecord = await Office.findOne({ name: office, deletedAt: null })
      if (!officeRecord) fail('Selected office was not found.', 404)
      staffMember.office = officeRecord.name
      staffMember.staffRole = staffRole
      await staffMember.save()
      return { user: publicUser(staffMember) }
    }
  )

  route(
    'post',
    '/api/admin/staff/:id/demote',
    ['admin'],
    async ({ req }) => {
      const staffMember = await User.findOne({ _id: req.params.id, role: 'staff', deletedAt: null })
      if (!staffMember) fail('Staff account not found.', 404)
      staffMember.role = 'student'
      staffMember.roles = ['student']
      staffMember.office = ''
      staffMember.staffRole = ''
      staffMember.schedule = []
      await staffMember.save()
      await Session.deleteMany({ userId: staffMember._id })
      return { user: publicUser(staffMember) }
    }
  )


  
route(
  'delete',
  '/api/admin/staff/:id',
  ['admin'],
  async ({ req, user: admin }) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      fail('Invalid staff ID.', 400);
    }

    const staffMember = await User.findOne({
      _id: req.params.id,
      role: 'staff',
      deletedAt: null
    });

    if (!staffMember) {
      fail('Staff account not found.', 404);
    }

    // Recoverable deletion
    staffMember.status = 'Inactive';
    staffMember.deletedAt = new Date();
    staffMember.deletedBy = admin._id;

    await staffMember.save();

    // Invalidate all MongoDB sessions for the staff account
    await Session.deleteMany({
      userId: staffMember._id
    });

    return {
      success: true,
      message: 'Staff account deleted successfully.',
      deletedStaffId: String(staffMember._id)
    };
  }
);

  route(
    'patch',
    '/api/admin/users/:id/status',
    [
      'admin',
    ],

    async ({
      req,
      body,
    }) => {
      const user =
        await User.findById(
          req.params.id
        )


      if (
        !user ||
        user.role ===
          'admin'
      ) {
        fail(
          'Managed account not found.',
          404
        )
      }


      const allowed =
        user.role ===
        'student'
          ? [
              'Active',
              'Suspended',
            ]
          : [
              'Active',
              'Inactive',
            ]


      if (
        !allowed.includes(
          body.status
        )
      ) {
        fail(
          'Invalid account status.'
        )
      }


      user.status =
        body.status


      await user.save()


      if (
        user.status !==
        'Active'
      ) {
        await Session.deleteMany(
          {
            userId:
              user._id,
          }
        )


        await Ticket.updateMany(
          {
            studentId:
              user._id,

            status: {
              $in:
                activeStatuses,
            },
          },
          {
            $set: {
              status:
                'cancelled',

              completedAt:
                new Date(),
            },
          }
        )
      }


      return {
        user:
          publicUser(user),
      }
    }
  )


  route(
    'delete',
    '/api/admin/users/:id',
    [
      'admin',
    ],

    async ({ req }) => {
      const user = await User.findById(req.params.id)

      if (!user || user.role === 'admin') {
        fail('Managed account not found.', 404)
      }

      await Session.deleteMany({ userId: user._id })
      await Ticket.updateMany(
        { studentId: user._id, status: { $in: activeStatuses } },
        { $set: { status: 'cancelled', completedAt: new Date() } }
      )
      await user.deleteOne()

      return { deleted: true }
    }
  )


  // ======================================================
  // SCHEDULE COLLECTION
  // These routes MUST remain inside createApp()
  // ======================================================

  route(
    'get',
    '/api/schedules/me',
    [
      'staff',
    ],

    async ({
      user,
    }) => {
      const schedule =
        await Schedule.findOne(
          {
            staffId:
              user._id,
          }
        )


      return {
        schedule:
          schedule || {
            staffId:
              user._id,

            office:
              user.office,

            shifts: [],
          },
      }
    }
  )


  route(
    'put',
    '/api/schedules/me',
    [
      'staff',
    ],

    async ({
      user,
      body,
    }) => {
      if (
        !Array.isArray(
          body.shifts
        )
      ) {
        fail(
          'Shifts must be an array.'
        )
      }


      if (
        body.shifts.length >
        21
      ) {
        fail(
          'Schedule must contain up to 21 shifts.'
        )
      }


      const days = [
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
        'Sunday',
      ]


      const shifts =
        body.shifts.map(
          shift => {
            const day =
              text(
                shift.day,
                'Day',
                20
              )


            const startTime =
              text(
                shift.startTime,
                'Start time',
                5
              )


            const endTime =
              text(
                shift.endTime,
                'End time',
                5
              )


            if (
              !days.includes(
                day
              )
            ) {
              fail(
                'Choose a valid day.'
              )
            }


            if (
              !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(
                startTime
              )
            ) {
              fail(
                'Start time must use HH:MM format.'
              )
            }


            if (
              !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(
                endTime
              )
            ) {
              fail(
                'End time must use HH:MM format.'
              )
            }


            if (
              startTime >=
              endTime
            ) {
              fail(
                'End time must be later than start time.'
              )
            }


            return {
              day,
              startTime,
              endTime,
            }
          }
        )


      const schedule =
        await Schedule.findOneAndUpdate(
          {
            staffId:
              user._id,
          },

          {
            $set: {
              staffId:
                user._id,

              office:
                user.office,

              shifts,
            },
          },

          {
            new: true,

            upsert: true,

            runValidators:
              true,

            setDefaultsOnInsert:
              true,
          }
        )


      return {
        schedule,
      }
    }
  )


  // ======================================================
  // 404 HANDLER
  // Keep this AFTER every API route
  // ======================================================

  app.use(
    '/api',
    (
      req,
      res
    ) =>
      res
        .status(404)
        .json({
          message:
            'API endpoint not found.',
        })
  )


  // ======================================================
  // ERROR HANDLER
  // ======================================================

  app.use(
    (
      error,
      req,
      res,
      next
    ) => {
      if (
        !error.status ||
        error.status >=
          500
      ) {
        console.error(
          'SERVER ERROR:',
          error
        )
      }


      res
        .status(
          error.status ||
          500
        )
        .json({
          message:
            error.status &&
            error.status <
              500
              ? error.message
              : process.env
                    .NODE_ENV ===
                  'production'
                ? 'Server error. Please try again.'
                : error.message ||
                  'Server error. Please try again.',
        })
    }
  )


  return {
    app,

    initialize,

    close:
      async () => {},
  }
}
