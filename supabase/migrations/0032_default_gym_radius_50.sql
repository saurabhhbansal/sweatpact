-- Change default gym radius from 150m to 50m everywhere.
alter table public.user_gyms alter column radius_m set default 50;
alter table public.profiles alter column gym_radius_m set default 50;

update public.user_gyms set radius_m = 50;
update public.profiles set gym_radius_m = 50;
