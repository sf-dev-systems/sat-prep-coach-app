/**
 * seed-skills.ts
 * Run this script to populate the `skills` table in Supabase.
 * The `weight` represents the impact on score prediction.
 */

export const SAT_SKILLS = [
  // --- READING & WRITING (Weight: 1.0) ---
  { section: 'rw', domain: 'Information and Ideas', name: 'Central Ideas and Details', weight: 0.26 },
  { section: 'rw', domain: 'Information and Ideas', name: 'Command of Evidence (Textual)', weight: 0.26 },
  { section: 'rw', domain: 'Information and Ideas', name: 'Command of Evidence (Quantitative)', weight: 0.26 },
  { section: 'rw', domain: 'Information and Ideas', name: 'Inferences', weight: 0.26 },
  
  { section: 'rw', domain: 'Craft and Structure', name: 'Words in Context', weight: 0.28 },
  { section: 'rw', domain: 'Craft and Structure', name: 'Text Structure and Purpose', weight: 0.28 },
  { section: 'rw', domain: 'Craft and Structure', name: 'Cross-Text Connections', weight: 0.28 },
  
  { section: 'rw', domain: 'Expression of Ideas', name: 'Rhetorical Synthesis', weight: 0.20 },
  { section: 'rw', domain: 'Expression of Ideas', name: 'Transitions', weight: 0.20 },
  
  { section: 'rw', domain: 'Standard English Conventions', name: 'Boundaries (Punctuation)', weight: 0.26 },
  { section: 'rw', domain: 'Standard English Conventions', name: 'Form, Structure, and Sense', weight: 0.26 },

  // --- MATH (Weight: 1.0) ---
  { section: 'math', domain: 'Algebra', name: 'Linear Equations in 1 Variable', weight: 0.35 },
  { section: 'math', domain: 'Algebra', name: 'Linear Equations in 2 Variables', weight: 0.35 },
  { section: 'math', domain: 'Algebra', name: 'Linear Functions', weight: 0.35 },
  { section: 'math', domain: 'Algebra', name: 'Systems of 2 Linear Equations', weight: 0.35 },
  { section: 'math', domain: 'Algebra', name: 'Linear Inequalities', weight: 0.35 },

  { section: 'math', domain: 'Advanced Math', name: 'Equivalent Expressions', weight: 0.35 },
  { section: 'math', domain: 'Advanced Math', name: 'Nonlinear Equations', weight: 0.35 },
  { section: 'math', domain: 'Advanced Math', name: 'Nonlinear Functions', weight: 0.35 },

  { section: 'math', domain: 'Problem-Solving & Data Analysis', name: 'Ratios, Rates, and Proportions', weight: 0.15 },
  { section: 'math', domain: 'Problem-Solving & Data Analysis', name: 'Percentages', weight: 0.15 },
  { section: 'math', domain: 'Problem-Solving & Data Analysis', name: 'One-Variable Data', weight: 0.15 },
  { section: 'math', domain: 'Problem-Solving & Data Analysis', name: 'Two-Variable Data (Scatterplots)', weight: 0.15 },
  { section: 'math', domain: 'Problem-Solving & Data Analysis', name: 'Probability and Conditional Probability', weight: 0.15 },

  { section: 'math', domain: 'Geometry and Trigonometry', name: 'Area and Volume', weight: 0.15 },
  { section: 'math', domain: 'Geometry and Trigonometry', name: 'Lines, Angles, and Triangles', weight: 0.15 },
  { section: 'math', domain: 'Geometry and Trigonometry', name: 'Right Triangles and Trigonometry', weight: 0.15 },
  { section: 'math', domain: 'Geometry and Trigonometry', name: 'Circles', weight: 0.15 },

  // --- STRATEGY (Weight: 0) ---
  { section: 'strategy', domain: 'Test Taking', name: 'Desmos Techniques', weight: 0 },
  { section: 'strategy', domain: 'Test Taking', name: 'RW Annotation Method', weight: 0 },
  { section: 'strategy', domain: 'Test Taking', name: 'Module Pacing', weight: 0 },
  { section: 'strategy', domain: 'Test Taking', name: 'Skip-and-Flag Discipline', weight: 0 },
  { section: 'strategy', domain: 'Test Taking', name: 'Elimination Discipline', weight: 0 },
  { section: 'strategy', domain: 'Test Taking', name: 'Distractor Pattern Recognition', weight: 0 },
  { section: 'strategy', domain: 'Test Taking', name: 'Guessing Under Time Pressure', weight: 0 },
  { section: 'strategy', domain: 'Test Taking', name: 'Grid-in Mechanics', weight: 0 },
];