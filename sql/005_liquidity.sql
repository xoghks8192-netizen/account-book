alter table assets add column if not exists liquidity text;

update assets set liquidity = case
  when category in ('전세자금', '연금저축', '주택청약') then '비유동'
  else '유동'
end
where liquidity is null;
