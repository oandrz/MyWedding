package repository

import (
	"context"
	"fmt"
	"sort"
	"sync"
	"time"

	"github.com/andreasronaldo/wedding-server/internal/models"
)

// MemoryRepository implements the Repository interface using in-memory maps.
// It mirrors the TypeScript MemStorage class for development and testing.
type MemoryRepository struct {
	mu sync.Mutex

	users         map[int]models.User
	userIDSeq     int
	rsvps         map[int]models.Rsvp
	rsvpIDSeq     int
	media         map[int]models.Media
	mediaIDSeq    int
	configImages  map[int]models.ConfigImage
	configIDSeq   int
	featureFlags  map[int]models.FeatureFlag
	flagIDSeq     int
	appSettings   map[int]models.AppSetting
	settingIDSeq  int
	welcomeScreen *models.WelcomeScreen
	messages      map[int]models.Message
	messageIDSeq  int
	invites        map[int]models.Invite
	inviteIDSeq    int
	scheduleEvents map[int]models.ScheduleEvent
	scheduleIDSeq  int
}

// NewMemoryRepository creates a new in-memory repository with seeded defaults.
func NewMemoryRepository() *MemoryRepository {
	return &MemoryRepository{
		users:        make(map[int]models.User),
		rsvps:        make(map[int]models.Rsvp),
		media:        make(map[int]models.Media),
		configImages: make(map[int]models.ConfigImage),
		flagIDSeq:    1,
		featureFlags: map[int]models.FeatureFlag{
			1: {
				ID:          1,
				FeatureKey:  "music_autoplay",
				FeatureName: "Music Autoplay",
				Description: "Autoplay background music when invitation opens",
				Enabled:     true,
				UpdatedAt:   now(),
			},
		},
		appSettings:    make(map[int]models.AppSetting),
		messages:       make(map[int]models.Message),
		invites:        make(map[int]models.Invite),
		scheduleEvents: make(map[int]models.ScheduleEvent),
	}
}

func now() string {
	return time.Now().UTC().Format(time.RFC3339)
}

// ---------------------------------------------------------------------------
// User
// ---------------------------------------------------------------------------

func (m *MemoryRepository) GetUser(_ context.Context, id int) (*models.User, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	u, ok := m.users[id]
	if !ok {
		return nil, nil
	}
	return &u, nil
}

func (m *MemoryRepository) GetUserByUsername(_ context.Context, username string) (*models.User, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, u := range m.users {
		if u.Username == username {
			return &u, nil
		}
	}
	return nil, nil
}

func (m *MemoryRepository) CreateUser(_ context.Context, user models.InsertUser) (*models.User, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.userIDSeq++
	u := models.User{
		ID:       m.userIDSeq,
		Username: user.Username,
		Password: user.Password,
	}
	m.users[u.ID] = u
	return &u, nil
}

// ---------------------------------------------------------------------------
// RSVP
// ---------------------------------------------------------------------------

func (m *MemoryRepository) CreateRsvp(_ context.Context, data models.InsertRsvp) (*models.Rsvp, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.rsvpIDSeq++
	r := models.Rsvp{
		ID:             m.rsvpIDSeq,
		Name:           data.Name,
		Email:          data.Email,
		AttendanceType: data.AttendanceType,
		GuestCount:     data.GuestCount,
	}
	m.rsvps[r.ID] = r
	return &r, nil
}

func (m *MemoryRepository) UpdateRsvp(_ context.Context, id int, data models.InsertRsvp) (*models.Rsvp, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	r, ok := m.rsvps[id]
	if !ok {
		return nil, nil
	}
	r.Name = data.Name
	r.Email = data.Email
	r.AttendanceType = data.AttendanceType
	r.GuestCount = data.GuestCount
	m.rsvps[id] = r
	return &r, nil
}

func (m *MemoryRepository) GetRsvps(_ context.Context) ([]models.Rsvp, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	result := make([]models.Rsvp, 0, len(m.rsvps))
	for _, r := range m.rsvps {
		result = append(result, r)
	}
	return result, nil
}

func (m *MemoryRepository) GetRsvpByEmail(_ context.Context, email string) (*models.Rsvp, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, r := range m.rsvps {
		if r.Email == email {
			return &r, nil
		}
	}
	return nil, nil
}

func (m *MemoryRepository) GetRsvpByName(_ context.Context, name string) (*models.Rsvp, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, r := range m.rsvps {
		if r.Name == name {
			return &r, nil
		}
	}
	return nil, nil
}

func (m *MemoryRepository) DeleteRsvp(_ context.Context, id int) (bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, ok := m.rsvps[id]; !ok {
		return false, nil
	}
	delete(m.rsvps, id)
	return true, nil
}

// ---------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------

func (m *MemoryRepository) CreateMedia(_ context.Context, data models.InsertMedia) (*models.Media, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.mediaIDSeq++

	mediaType := "image"
	if data.MediaType != nil {
		mediaType = *data.MediaType
	}

	md := models.Media{
		ID:        m.mediaIDSeq,
		Name:      data.Name,
		Email:     data.Email,
		MediaURL:  data.MediaURL,
		MediaType: mediaType,
		Caption:   data.Caption,
		Approved:  false,
		CreatedAt: now(),
	}
	m.media[md.ID] = md
	return &md, nil
}

func (m *MemoryRepository) GetMediaByID(_ context.Context, id int) (*models.Media, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	md, ok := m.media[id]
	if !ok {
		return nil, nil
	}
	return &md, nil
}

func (m *MemoryRepository) GetAllMedia(_ context.Context) ([]models.Media, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	result := make([]models.Media, 0, len(m.media))
	for _, md := range m.media {
		result = append(result, md)
	}
	return result, nil
}

func (m *MemoryRepository) GetApprovedMedia(_ context.Context) ([]models.Media, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	var result []models.Media
	for _, md := range m.media {
		if md.Approved {
			result = append(result, md)
		}
	}
	if result == nil {
		result = []models.Media{}
	}
	return result, nil
}

func (m *MemoryRepository) GetApprovedMediaPaginated(_ context.Context, limit, offset int) ([]models.Media, int, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	approved := make([]models.Media, 0)
	for _, md := range m.media {
		if md.Approved {
			approved = append(approved, md)
		}
	}
	total := len(approved)

	sort.Slice(approved, func(i, j int) bool { return approved[i].ID > approved[j].ID })

	if offset >= total {
		return []models.Media{}, total, nil
	}
	end := offset + limit
	if end > total {
		end = total
	}
	return approved[offset:end], total, nil
}

func (m *MemoryRepository) UpdateMediaApproval(_ context.Context, id int, approved bool) (*models.Media, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	md, ok := m.media[id]
	if !ok {
		return nil, nil
	}
	md.Approved = approved
	m.media[id] = md
	return &md, nil
}

// ---------------------------------------------------------------------------
// Config Images
// ---------------------------------------------------------------------------

func (m *MemoryRepository) CreateConfigImage(_ context.Context, data models.InsertConfigImage) (*models.ConfigImage, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.configIDSeq++

	isActive := true
	if data.IsActive != nil {
		isActive = *data.IsActive
	}

	displayOrder := 0
	if data.DisplayOrder != nil {
		displayOrder = *data.DisplayOrder
	}

	ci := models.ConfigImage{
		ID:           m.configIDSeq,
		ImageKey:     data.ImageKey,
		ImageURL:     data.ImageURL,
		ThumbnailURL: data.ThumbnailURL,
		ImageType:    data.ImageType,
		Title:        data.Title,
		Description:  data.Description,
		IsActive:     isActive,
		DisplayOrder: displayOrder,
		UpdatedAt:    now(),
	}
	m.configImages[ci.ID] = ci
	return &ci, nil
}

func (m *MemoryRepository) UpdateConfigImage(_ context.Context, imageKey string, data models.InsertConfigImage) (*models.ConfigImage, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	for id, ci := range m.configImages {
		if ci.ImageKey == imageKey {
			ci.ImageURL = data.ImageURL
			ci.ThumbnailURL = data.ThumbnailURL
			ci.ImageType = data.ImageType
			ci.Title = data.Title
			ci.Description = data.Description
			if data.IsActive != nil {
				ci.IsActive = *data.IsActive
			}
			if data.DisplayOrder != nil {
				ci.DisplayOrder = *data.DisplayOrder
			}
			ci.UpdatedAt = now()
			m.configImages[id] = ci
			return &ci, nil
		}
	}
	return nil, nil
}

func (m *MemoryRepository) DeleteConfigImage(_ context.Context, imageKey string) (bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for id, ci := range m.configImages {
		if ci.ImageKey == imageKey {
			delete(m.configImages, id)
			return true, nil
		}
	}
	return false, nil
}

func (m *MemoryRepository) GetConfigImage(_ context.Context, imageKey string) (*models.ConfigImage, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, ci := range m.configImages {
		if ci.ImageKey == imageKey {
			return &ci, nil
		}
	}
	return nil, nil
}

func (m *MemoryRepository) GetConfigImagesByType(_ context.Context, imageType string) ([]models.ConfigImage, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	var result []models.ConfigImage
	for _, ci := range m.configImages {
		if ci.ImageType == imageType {
			result = append(result, ci)
		}
	}
	if result == nil {
		result = []models.ConfigImage{}
	}
	return result, nil
}

func (m *MemoryRepository) GetAllConfigImages(_ context.Context) ([]models.ConfigImage, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	result := make([]models.ConfigImage, 0, len(m.configImages))
	for _, ci := range m.configImages {
		result = append(result, ci)
	}
	return result, nil
}

func (m *MemoryRepository) ReorderConfigImages(_ context.Context, imageType string, orderedKeys []string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Build a lookup from imageKey -> map ID for images matching the type.
	keyToID := make(map[string]int)
	for id, ci := range m.configImages {
		if ci.ImageType == imageType {
			keyToID[ci.ImageKey] = id
		}
	}

	for order, key := range orderedKeys {
		if id, ok := keyToID[key]; ok {
			ci := m.configImages[id]
			ci.DisplayOrder = order
			ci.UpdatedAt = now()
			m.configImages[id] = ci
		}
	}
	return nil
}

// ---------------------------------------------------------------------------
// Feature Flags
// ---------------------------------------------------------------------------

func (m *MemoryRepository) CreateFeatureFlag(_ context.Context, data models.InsertFeatureFlag) (*models.FeatureFlag, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.flagIDSeq++

	enabled := false
	if data.Enabled != nil {
		enabled = *data.Enabled
	}

	ff := models.FeatureFlag{
		ID:          m.flagIDSeq,
		FeatureKey:  data.FeatureKey,
		FeatureName: data.FeatureName,
		Description: data.Description,
		Enabled:     enabled,
		UpdatedAt:   now(),
	}
	m.featureFlags[ff.ID] = ff
	return &ff, nil
}

func (m *MemoryRepository) UpdateFeatureFlag(_ context.Context, featureKey string, enabled bool) (*models.FeatureFlag, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for id, ff := range m.featureFlags {
		if ff.FeatureKey == featureKey {
			ff.Enabled = enabled
			ff.UpdatedAt = now()
			m.featureFlags[id] = ff
			return &ff, nil
		}
	}
	return nil, nil
}

func (m *MemoryRepository) GetFeatureFlag(_ context.Context, featureKey string) (*models.FeatureFlag, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, ff := range m.featureFlags {
		if ff.FeatureKey == featureKey {
			return &ff, nil
		}
	}
	return nil, nil
}

func (m *MemoryRepository) GetAllFeatureFlags(_ context.Context) ([]models.FeatureFlag, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	result := make([]models.FeatureFlag, 0, len(m.featureFlags))
	for _, ff := range m.featureFlags {
		result = append(result, ff)
	}
	return result, nil
}

// ---------------------------------------------------------------------------
// App Settings
// ---------------------------------------------------------------------------

func (m *MemoryRepository) CreateAppSetting(_ context.Context, data models.InsertAppSetting) (*models.AppSetting, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.settingIDSeq++

	as := models.AppSetting{
		ID:           m.settingIDSeq,
		SettingKey:   data.SettingKey,
		SettingValue: data.SettingValue,
		SettingType:  data.SettingType,
		Description:  data.Description,
		UpdatedAt:    now(),
	}
	m.appSettings[as.ID] = as
	return &as, nil
}

func (m *MemoryRepository) UpdateAppSetting(_ context.Context, settingKey string, data models.InsertAppSetting) (*models.AppSetting, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for id, as := range m.appSettings {
		if as.SettingKey == settingKey {
			as.SettingValue = data.SettingValue
			as.SettingType = data.SettingType
			as.Description = data.Description
			as.UpdatedAt = now()
			m.appSettings[id] = as
			return &as, nil
		}
	}
	return nil, nil
}

func (m *MemoryRepository) UpsertAppSettings(_ context.Context, settings []models.InsertAppSetting) (int, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	count := 0
	for _, s := range settings {
		found := false
		for id, as := range m.appSettings {
			if as.SettingKey == s.SettingKey {
				as.SettingValue = s.SettingValue
				as.SettingType = s.SettingType
				as.Description = s.Description
				as.UpdatedAt = now()
				m.appSettings[id] = as
				found = true
				break
			}
		}
		if !found {
			m.settingIDSeq++
			m.appSettings[m.settingIDSeq] = models.AppSetting{
				ID:           m.settingIDSeq,
				SettingKey:   s.SettingKey,
				SettingValue: s.SettingValue,
				SettingType:  s.SettingType,
				Description:  s.Description,
				UpdatedAt:    now(),
			}
		}
		count++
	}
	return count, nil
}

func (m *MemoryRepository) GetAppSetting(_ context.Context, settingKey string) (*models.AppSetting, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, as := range m.appSettings {
		if as.SettingKey == settingKey {
			return &as, nil
		}
	}
	return nil, nil
}

func (m *MemoryRepository) GetAllAppSettings(_ context.Context) ([]models.AppSetting, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	result := make([]models.AppSetting, 0, len(m.appSettings))
	for _, as := range m.appSettings {
		result = append(result, as)
	}
	return result, nil
}

// ---------------------------------------------------------------------------
// Welcome Screen
// ---------------------------------------------------------------------------

func (m *MemoryRepository) GetWelcomeScreen(_ context.Context) (*models.WelcomeScreen, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.welcomeScreen == nil {
		return nil, nil
	}
	ws := *m.welcomeScreen
	return &ws, nil
}

func (m *MemoryRepository) UpdateWelcomeScreen(_ context.Context, data models.InsertWelcomeScreen) (*models.WelcomeScreen, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.welcomeScreen == nil {
		m.welcomeScreen = &models.WelcomeScreen{
			ID:              1,
			HeadingText:     "Welcome",
			HeadingTextID:   "",
			DeliveryLabel:   "Delivery",
			DeliveryLabelID: "",
			FallbackName:    "Guest",
			Enabled:         true,
			UpdatedAt:       now(),
		}
	}

	if data.HeadingText != nil {
		m.welcomeScreen.HeadingText = *data.HeadingText
	}
	if data.HeadingTextID != nil {
		m.welcomeScreen.HeadingTextID = *data.HeadingTextID
	}
	if data.DeliveryLabel != nil {
		m.welcomeScreen.DeliveryLabel = *data.DeliveryLabel
	}
	if data.DeliveryLabelID != nil {
		m.welcomeScreen.DeliveryLabelID = *data.DeliveryLabelID
	}
	if data.FallbackName != nil {
		m.welcomeScreen.FallbackName = *data.FallbackName
	}
	if data.Enabled != nil {
		m.welcomeScreen.Enabled = *data.Enabled
	}
	m.welcomeScreen.UpdatedAt = now()

	ws := *m.welcomeScreen
	return &ws, nil
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

func (m *MemoryRepository) CreateMessage(_ context.Context, data models.InsertMessage) (*models.Message, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.messageIDSeq++

	msg := models.Message{
		ID:        m.messageIDSeq,
		Name:      data.Name,
		Email:     data.Email,
		Content:   data.Content,
		CreatedAt: now(),
	}
	m.messages[msg.ID] = msg
	return &msg, nil
}

func (m *MemoryRepository) GetMessageByID(_ context.Context, id int) (*models.Message, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	msg, ok := m.messages[id]
	if !ok {
		return nil, nil
	}
	return &msg, nil
}

func (m *MemoryRepository) GetAllMessages(_ context.Context) ([]models.Message, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	result := make([]models.Message, 0, len(m.messages))
	for _, msg := range m.messages {
		result = append(result, msg)
	}
	return result, nil
}

func (m *MemoryRepository) GetMessagesPaginated(_ context.Context, limit, offset int) ([]models.Message, int, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	all := make([]models.Message, 0, len(m.messages))
	for _, msg := range m.messages {
		all = append(all, msg)
	}
	total := len(all)

	sort.Slice(all, func(i, j int) bool { return all[i].ID > all[j].ID })

	if offset >= total {
		return []models.Message{}, total, nil
	}
	end := offset + limit
	if end > total {
		end = total
	}
	return all[offset:end], total, nil
}

func (m *MemoryRepository) DeleteMessage(_ context.Context, id int) (bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, ok := m.messages[id]; !ok {
		return false, nil
	}
	delete(m.messages, id)
	return true, nil
}

// ---------------------------------------------------------------------------
// Invites
// ---------------------------------------------------------------------------

func (m *MemoryRepository) CreateInvite(_ context.Context, data models.InsertInvite) (*models.Invite, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.inviteIDSeq++

	// Generate unique code (retry on collision)
	var code string
	for i := 0; i < 5; i++ {
		code = models.GenerateInviteCode()
		collision := false
		for _, existing := range m.invites {
			if existing.Code == code {
				collision = true
				break
			}
		}
		if !collision {
			break
		}
	}

	inv := models.Invite{
		ID:        m.inviteIDSeq,
		Name:      data.Name,
		Code:      code,
		Phone:     data.Phone,
		Side:      data.Side,
		CreatedAt: now(),
	}
	m.invites[inv.ID] = inv
	return &inv, nil
}

func (m *MemoryRepository) GetInvites(_ context.Context) ([]models.Invite, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	result := make([]models.Invite, 0, len(m.invites))
	for _, inv := range m.invites {
		if inv.RsvpID != nil {
			if r, ok := m.rsvps[*inv.RsvpID]; ok {
				inv.Rsvp = &r
			}
		}
		result = append(result, inv)
	}
	return result, nil
}

func (m *MemoryRepository) GetInviteByID(_ context.Context, id int) (*models.Invite, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	inv, ok := m.invites[id]
	if !ok {
		return nil, nil
	}
	if inv.RsvpID != nil {
		if r, ok := m.rsvps[*inv.RsvpID]; ok {
			inv.Rsvp = &r
		}
	}
	return &inv, nil
}

func (m *MemoryRepository) GetInviteByCode(_ context.Context, code string) (*models.Invite, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, inv := range m.invites {
		if inv.Code == code {
			if inv.RsvpID != nil {
				if r, ok := m.rsvps[*inv.RsvpID]; ok {
					inv.Rsvp = &r
				}
			}
			return &inv, nil
		}
	}
	return nil, nil
}

func (m *MemoryRepository) DeleteInvite(_ context.Context, id int) (bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, ok := m.invites[id]; !ok {
		return false, nil
	}
	delete(m.invites, id)
	return true, nil
}

func (m *MemoryRepository) UpdateInviteRsvpID(_ context.Context, inviteID int, rsvpID *int) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	inv, ok := m.invites[inviteID]
	if !ok {
		return nil
	}
	inv.RsvpID = rsvpID
	m.invites[inviteID] = inv
	return nil
}

func (m *MemoryRepository) CreateInvitesBulk(_ context.Context, data []models.InsertInvite) ([]models.Invite, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	result := make([]models.Invite, 0, len(data))
	for _, d := range data {
		m.inviteIDSeq++

		// Generate unique code (retry on collision)
		var code string
		for i := 0; i < 5; i++ {
			code = models.GenerateInviteCode()
			collision := false
			for _, existing := range m.invites {
				if existing.Code == code {
					collision = true
					break
				}
			}
			if !collision {
				break
			}
		}

		inv := models.Invite{
			ID:        m.inviteIDSeq,
			Name:      d.Name,
			Code:      code,
			Phone:     d.Phone,
			Side:      d.Side,
			CreatedAt: now(),
		}
		m.invites[inv.ID] = inv
		result = append(result, inv)
	}
	return result, nil
}

func (m *MemoryRepository) UpdateInvitePhone(_ context.Context, id int, phone *string) (*models.Invite, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	inv, ok := m.invites[id]
	if !ok {
		return nil, fmt.Errorf("invite not found")
	}
	inv.Phone = phone
	m.invites[id] = inv
	return &inv, nil
}

func (m *MemoryRepository) UpdateInvite(_ context.Context, id int, name string, phone *string, side *string) (*models.Invite, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	inv, ok := m.invites[id]
	if !ok {
		return nil, fmt.Errorf("invite not found")
	}
	inv.Name = name
	inv.Phone = phone
	inv.Side = side
	m.invites[id] = inv
	return &inv, nil
}

func (m *MemoryRepository) UpdateInviteSide(_ context.Context, id int, side *string) (*models.Invite, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	inv, ok := m.invites[id]
	if !ok {
		return nil, fmt.Errorf("invite not found")
	}
	inv.Side = side
	m.invites[id] = inv
	return &inv, nil
}

func (m *MemoryRepository) MarkInviteWaSent(_ context.Context, id int) (*models.Invite, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	inv, ok := m.invites[id]
	if !ok {
		return nil, fmt.Errorf("invite not found")
	}
	ts := now()
	inv.WaSentAt = &ts
	m.invites[id] = inv
	return &inv, nil
}

func (m *MemoryRepository) UnmarkInviteWaSent(_ context.Context, id int) (*models.Invite, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	inv, ok := m.invites[id]
	if !ok {
		return nil, fmt.Errorf("invite not found")
	}
	inv.WaSentAt = nil
	m.invites[id] = inv
	return &inv, nil
}

// ---------------------------------------------------------------------------
// Schedule Events
// ---------------------------------------------------------------------------

func (m *MemoryRepository) GetScheduleEvents(_ context.Context) ([]models.ScheduleEvent, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	result := make([]models.ScheduleEvent, 0, len(m.scheduleEvents))
	for _, e := range m.scheduleEvents {
		result = append(result, e)
	}
	sort.Slice(result, func(i, j int) bool {
		if result[i].SortOrder != result[j].SortOrder {
			return result[i].SortOrder < result[j].SortOrder
		}
		return result[i].ID < result[j].ID
	})
	return result, nil
}

func (m *MemoryRepository) CreateScheduleEvent(_ context.Context, data models.InsertScheduleEvent) (*models.ScheduleEvent, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.scheduleIDSeq++
	e := models.ScheduleEvent{
		ID:            m.scheduleIDSeq,
		Title:         data.Title,
		TitleID:       data.TitleID,
		Time:          data.Time,
		Description:   data.Description,
		DescriptionID: data.DescriptionID,
		SortOrder:     data.SortOrder,
		CreatedAt:     now(),
	}
	m.scheduleEvents[e.ID] = e
	return &e, nil
}

func (m *MemoryRepository) UpdateScheduleEvent(_ context.Context, id int, data models.UpdateScheduleEvent) (*models.ScheduleEvent, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	e, ok := m.scheduleEvents[id]
	if !ok {
		return nil, nil
	}
	e.Title = data.Title
	e.TitleID = data.TitleID
	e.Time = data.Time
	e.Description = data.Description
	e.DescriptionID = data.DescriptionID
	m.scheduleEvents[id] = e
	return &e, nil
}

func (m *MemoryRepository) DeleteScheduleEvent(_ context.Context, id int) (bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, ok := m.scheduleEvents[id]; !ok {
		return false, nil
	}
	delete(m.scheduleEvents, id)
	return true, nil
}

func (m *MemoryRepository) ReorderScheduleEvents(_ context.Context, items []models.ScheduleOrderItem) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, item := range items {
		e, ok := m.scheduleEvents[item.ID]
		if !ok {
			continue
		}
		e.SortOrder = item.SortOrder
		m.scheduleEvents[item.ID] = e
	}
	return nil
}
